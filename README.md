🎨 draw-n-go

Draw & Go is a mobile app that gamifies physical activity by transforming real-world movement into collaborative digital art. 
A "Painter" defines a target pattern or shape, and "Runners" physically move—jogging or walking—to replicate the shape using GPS tracking.
The app encourages creativity, teamwork, and physical exercise, blending fitness with location-based interaction.


This project demonstrates IoT concepts — connectivity, distributed systems, and real-time synchronization — using only mobile phones and a web browser.

🚀 Features

📱 Phone as IoT device – each participant joins directly from their mobile browser

🖼️ Shape templates – one player selects a predefined template (star, square, etc.), or creates a new one on-the-fly. The template is then adjusted to the real location and playground the player is in.

🗣️ Instruction-based gameplay – the leader guides others to recreate the shape, while watching their live trail (unique trail color per player) on his phone.

🗺️ Map-based interaction – players draw collaboratively on a shared map

⚡ Real-time synchronization – updates appear instantly across all connected devices

👥 Multi-player sessions – supports interactive group play


🧱 Tech Stack

Frontend: React (JavaScript)

Backend: 
- **Node.js** (game logic + real-time event handling), with **Azure functions**
- **SQL Server** for data persistence


Real-Time Communication: WebSockets

Deployment: Works in any modern browser, optimized for mobile

📂 Project Structure
```
draw-n-go/
├─ frontend/           # React web app (mobile-first UI)
├─ backend/            # Node.js / Azure Functions (game + realtime)
├─ assets/             # Images, demo video, UI art
├─ App.js              # App entry / host bootstrap
├─ index.html          # Static host page
├─ package.json        # Root scripts/deps
├─ app.config.js       # App configuration
└─ local.settings.json # Local env (Azure Functions)
```

⚙️ Getting Started
Prerequisites

Node.js (>= 16)

npm

Setup Steps

Clone the repo

git clone https://github.com/amitbraun/draw-n-go.git
cd draw-n-go


Install dependencies

npm install


Run the server

npm start


Connect with your phone
Open the app in your browser (localhost or deployed URL).
Share the link with friends — everyone can join from their phones.


🎓 Academic Context

This project was developed as part of the IoT Workshop course.
It explores how IoT principles — connectivity, distributed systems, and real-time collaboration — can be implemented using smartphones as IoT devices.

🤝 Contributors

Built with 💙 by Amit Braun
 and Amit Zucker.

📜 License

Licensed under the MIT License.
