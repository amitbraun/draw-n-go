// ScoreCalculator.js
// Computes accuracy between combined brush trails and the template boundary.
// Approach:
// - Build template polyline (polygon boundary or sampled circle/star/square/triangle) in meters space
// - Combine all brush polylines, resample to uniform step in meters
// - Coverage: fraction of template samples within tolerance of any trail segment
// - Precision: fraction of trail samples within tolerance of template boundary
// - Accuracy: harmonic mean (F1-like) of coverage and precision; reported as percentage

function metersPerDegLat() {
  return 111_320; // approx
}
function metersPerDegLng(lat) {
  return 111_320 * Math.abs(Math.cos((lat * Math.PI) / 180));
}

function toXYMeters(p, origin) {
  // p: {lat,lng}; origin:{lat,lng}
  const mLat = metersPerDegLat();
  const mLng = metersPerDegLng(origin.lat || 0);
  return {
    x: (p.lng - origin.lng) * mLng,
    y: (p.lat - origin.lat) * mLat,
  };
}

function distancePointToSegment(a, b, p) {
  // a,b,p in XY meters; return distance meters
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = p.x - a.x;
  const wy = p.y - a.y;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(p.x - b.x, p.y - b.y);
  const t = c1 / c2;
  const projx = a.x + t * vx;
  const projy = a.y + t * vy;
  return Math.hypot(p.x - projx, p.y - projy);
}

function distancePointToPolylineMeters(p, polylineXY) {
  if (!polylineXY || polylineXY.length === 0) return Infinity;
  let best = Infinity;
  for (let i = 0; i < polylineXY.length - 1; i++) {
    const d = distancePointToSegment(polylineXY[i], polylineXY[i + 1], p);
    if (d < best) best = d;
  }
  return best;
}

function pathLengthMeters(pointsXY) {
  let L = 0;
  for (let i = 0; i < pointsXY.length - 1; i++) {
    L += Math.hypot(pointsXY[i + 1].x - pointsXY[i].x, pointsXY[i + 1].y - pointsXY[i].y);
  }
  return L;
}

function resamplePolyline(pointsXY, stepMeters) {
  if (!pointsXY || pointsXY.length === 0) return [];
  const out = [pointsXY[0]];
  let acc = 0;
  for (let i = 0; i < pointsXY.length - 1; i++) {
    const a = pointsXY[i];
    const b = pointsXY[i + 1];
    let segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen === 0) continue;
    let ux = (b.x - a.x) / segLen;
    let uy = (b.y - a.y) / segLen;
    while (acc + segLen >= stepMeters) {
      const remain = stepMeters - acc;
      const nx = out[out.length - 1].x + ux * remain;
      const ny = out[out.length - 1].y + uy * remain;
      out.push({ x: nx, y: ny });
      segLen -= remain;
      acc = 0;
    }
    acc += segLen;
  }
  return out;
}

function densifyPath(pointsXY, stepMeters, closed = true) {
  // Add intermediate points along edges to ensure even sampling for coverage checks
  if (!pointsXY || pointsXY.length < 2) return pointsXY || [];
  const out = [];
  const n = pointsXY.length;
  const maxIdx = closed ? n : n - 1;
  for (let i = 0; i < maxIdx; i++) {
    const a = pointsXY[i];
    const b = pointsXY[(i + 1) % n];
    out.push(a);
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen > stepMeters) {
      const steps = Math.floor(segLen / stepMeters);
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
  }
  if (!closed) out.push(pointsXY[n - 1]);
  return out;
}

function buildTemplateBoundary(template) {
  if (!template || !template.center || !template.center.lat || !template.center.lng) return [];
  const center = { lat: Number(template.center.lat), lng: Number(template.center.lng) };
  const radius = Number(template.radiusMeters || 0);
  const id = template.templateId;
  const lat = center.lat, lng = center.lng;
  const dLat = radius / metersPerDegLat();
  const dLng = radius / metersPerDegLng(lat);

  // Polygon provided
  if (id === 'polygon' && Array.isArray(template.vertices) && template.vertices.length >= 2) {
    return template.vertices.map(v => ({ lat: Number(v.lat), lng: Number(v.lng) }));
  }

  // Try catalog baseVertices on template if present
  if (template.catalogDefinition && Array.isArray(template.catalogDefinition.baseVertices)) {
    const base = template.catalogDefinition.baseVertices;
    return base.map(p => ({ lat: lat + (Number(p.y) || 0) * dLat, lng: lng + (Number(p.x) || 0) * dLng }));
  }

  // Known shapes
  if (id === 'square') {
    return [
      { lat: lat + dLat, lng: lng - dLng },
      { lat: lat + dLat, lng: lng + dLng },
      { lat: lat - dLat, lng: lng + dLng },
      { lat: lat - dLat, lng: lng - dLng },
    ];
  }
  if (id === 'triangle') {
    const top = { lat: lat + dLat, lng };
    const left = { lat: lat - dLat, lng: lng - dLng };
    const right = { lat: lat - dLat, lng: lng + dLng };
    return [top, right, left];
  }
  if (id === 'star') {
    // 5-point star based on outer radius=r and inner radius=0.5*r
    const outer = 1;
    const inner = 0.5;
    const pts = [];
    const cx = lng, cy = lat;
    for (let i = 0; i < 10; i++) {
      const r = (i % 2 === 0) ? outer : inner;
      const ang = -Math.PI / 2 + (i * Math.PI) / 5; // start at top
      const yy = cy + (r * dLat) * Math.sin(ang);
      const xx = cx + (r * dLng) * Math.cos(ang);
      pts.push({ lat: yy, lng: xx });
    }
    return pts;
  }
  // Default: circle approximation
  const pts = [];
  const N = 64;
  for (let i = 0; i < N; i++) {
    const ang = (2 * Math.PI * i) / N;
    pts.push({ lat: lat + dLat * Math.sin(ang), lng: lng + dLng * Math.cos(ang) });
  }
  return pts;
}

function mergeTrails(trails) {
  // trails: { user: [{latitude, longitude}, ...] }
  const lines = [];
  if (!trails) return lines;
  Object.values(trails).forEach(arr => {
    if (Array.isArray(arr) && arr.length) {
      // dedupe consecutive duplicates
      const uniq = [];
      for (let i = 0; i < arr.length; i++) {
        const p = arr[i];
        if (!p) continue;
        const last = uniq[uniq.length - 1];
        if (!last || last.latitude !== p.latitude || last.longitude !== p.longitude) uniq.push(p);
      }
      if (uniq.length >= 1) lines.push(uniq);
    }
  });
  return lines;
}

function flattenPolylineSegmentsXY(linesXY) {
  const pts = [];
  linesXY.forEach(line => {
    for (let i = 0; i < line.length; i++) pts.push(line[i]);
  });
  return pts;
}

export function scoreWalkVsTemplate(trails, template) {
  try {
    const boundaryLL = buildTemplateBoundary(template);
    if (!boundaryLL || boundaryLL.length < 3) {
      return { accuracyPct: 0, coverage: 0, precision: 0, f1: 0, reason: 'No template boundary' };
    }
    const origin = template.center || boundaryLL[0];

    // Template boundary in XY meters and densified
    const boundaryXY = boundaryLL.map(p => toXYMeters(p, origin));
  const isPoly = template && template.templateId === 'polygon';
  const boundaryPts = densifyPath(boundaryXY, 2, !isPoly); // polygons open, others closed

    // Trails merged; convert to XY; resample each trail to 2m steps
    const lines = mergeTrails(trails);
    const linesXY = lines.map(line => line.map(p => toXYMeters({ lat: p.latitude, lng: p.longitude }, origin)));
    const sampledTrailXY = linesXY.map(lineXY => resamplePolyline(lineXY, 2));

    const allTrailPoints = flattenPolylineSegmentsXY(sampledTrailXY);
    if (allTrailPoints.length === 0) {
      return { accuracyPct: 0, coverage: 0, precision: 0, f1: 0, reason: 'No trail points' };
    }

    const radius = Number(template.radiusMeters || 50);
    const tol = Math.max(3, Math.min(0.06 * radius, 10)); // 3m min, 6% of radius, cap 10m

    // Coverage: template samples close to any trail
    let covered = 0;
    for (let i = 0; i < boundaryPts.length; i++) {
      const d = distancePointToPolylineMeters(boundaryPts[i], allTrailPoints);
      if (d <= tol) covered++;
    }
    const coverage = covered / boundaryPts.length;

    // Precision: trail samples close to template boundary
    let onShape = 0;
    for (let i = 0; i < allTrailPoints.length; i++) {
  const d = distancePointToPolylineMeters(allTrailPoints[i], boundaryPts);
      if (d <= tol) onShape++;
    }
    const precision = onShape / allTrailPoints.length;

    const f1 = (coverage + precision) > 0 ? (2 * coverage * precision) / (coverage + precision) : 0;
    const accuracyPct = Math.round(f1 * 100);

    return { accuracyPct, coverage, precision, f1, tol };
  } catch (e) {
    return { accuracyPct: 0, coverage: 0, precision: 0, f1: 0, error: String(e) };
  }
}

export function scorePerUserAndTeam(trails, template, users = null) {
  // trails: { username: [{latitude, longitude}, ...] }
  // users: optional array to include; if null, include all keys in trails
  try {
    const boundaryLL = buildTemplateBoundary(template);
    if (!boundaryLL || boundaryLL.length < 3) {
      return { perUser: [], team: { accuracyPct: 0, adjustedPct: 0, coverage: 0, precision: 0, f1: 0 } };
    }
    const origin = template.center || boundaryLL[0];
    const boundaryXY = boundaryLL.map(p => toXYMeters(p, origin));
  const isPoly2 = template && template.templateId === 'polygon';
  const boundaryPts = densifyPath(boundaryXY, 2, !isPoly2);

    const usernames = users && Array.isArray(users) && users.length
      ? users
      : Object.keys(trails || {});

    // Helper to score a set of lines against the precomputed boundary
    const scoreLines = (lines) => {
      const linesXY = lines.map(line => line.map(p => toXYMeters({ lat: p.latitude, lng: p.longitude }, origin)));
      const sampledTrailXY = linesXY.map(lineXY => resamplePolyline(lineXY, 2));
      const allTrailPoints = flattenPolylineSegmentsXY(sampledTrailXY);
      if (allTrailPoints.length === 0) return { coverage: 0, precision: 0, f1: 0, adjusted: 0, accuracyPct: 0, adjustedPct: 0 };
      const radius = Number(template.radiusMeters || 50);
      const tol = Math.max(3, Math.min(0.06 * radius, 10));
      let covered = 0;
      for (let i = 0; i < boundaryPts.length; i++) {
        const d = distancePointToPolylineMeters(boundaryPts[i], allTrailPoints);
        if (d <= tol) covered++;
      }
      const coverage = covered / boundaryPts.length;
      let onShape = 0;
      for (let i = 0; i < allTrailPoints.length; i++) {
  const d = distancePointToPolylineMeters(allTrailPoints[i], boundaryPts);
        if (d <= tol) onShape++;
      }
      const precision = onShape / allTrailPoints.length;
      const f1 = (coverage + precision) > 0 ? (2 * coverage * precision) / (coverage + precision) : 0;
      // Completion-corrected accuracy: line accuracy scaled by completion length
      const adjusted = precision * coverage;
      return {
        coverage, precision, f1, adjusted,
        accuracyPct: Math.round(f1 * 100),
        adjustedPct: Math.round(adjusted * 100),
      };
    };

    // Per-user
    const perUser = usernames.map(u => {
      const lines = (trails && trails[u]) ? [mergeTrails({ [u]: trails[u] })[0] || []] : [];
      const metrics = scoreLines(lines.filter(Boolean));
      return { username: u, ...metrics };
    });

    // Team (merge all)
    const allLines = mergeTrails(trails);
    const team = scoreLines(allLines);

    // Derive a simple points metric for the results page:
    // Base points from team adjustedPct scaled by shape difficulty and radius/time/teamSize factors.
    const shapeId = (template && template.templateId) || 'circle';
    // Prefer server-provided multiplier if available; fallback to defaults per requirements
    const difficulty = (template && typeof template.multiplier === 'number')
      ? Number(template.multiplier)
      : (
        shapeId === 'star' ? 1.6 :
        shapeId === 'square' ? 1.3 :
        shapeId === 'triangle' ? 1.15 :
        shapeId === 'circle' ? 1.05 :
        shapeId === 'polygon' ? 1.0 : 1.0
      );
    const radius = Number(template.radiusMeters || 50);
    const radiusFactor = Math.max(0.8, Math.min(1.5, radius / 100)); // 100m => 1.0, 50m => 0.8, 150m+ => 1.5
    const teamSize = Math.max(1, Object.keys(trails || {}).length);
    const teamFactor = 1 + Math.log10(teamSize); // diminishing returns with more brushes
    // timeSeconds can optionally be attached to template for scoring; default mild factor
    const timeSec = Number(template.timeSeconds || 60);
    const timeFactor = Math.max(0.8, Math.min(1.2, 90 / Math.max(30, timeSec)));
  // Base percentage for points: use total adjusted accuracy (0..100) scaled by 12 => 0..1200
  const basePct = (team.adjustedPct || 0) * 12;
    const points = Math.round(basePct * difficulty * radiusFactor * teamFactor * timeFactor);
    return { perUser, team: { ...team, points } };
  } catch (e) {
    return { perUser: [], team: { accuracyPct: 0, adjustedPct: 0, coverage: 0, precision: 0, f1: 0, error: String(e) } };
  }
}
