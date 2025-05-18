// app.config.js
export default {
    expo: {
      name: "DrawAndGo",
      version: "1.0.0",
      sdkVersion: "53.0.0",
      extra: {
        WEATHER_API_KEY: require('./expo.settings.json').WEATHER_API_KEY
      }
    }
  }
  