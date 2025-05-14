# 3D Particle Physics Simulator

An interactive 3D particle physics simulator built with React, Three.js, and React Three Fiber.

## Features

- Real-time 3D particle simulation with customizable parameters
- Realistic physics with configurable friction and gravity
- Collision detection and visualization
- Interactive speed and collision graphs
- Adjustable particle count, size, and initial velocity
- Collision color effects with configurable fade duration

## Live Demo

Check out the live demo [here](https://yourusername.github.io/particlesimulator).

## Development

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/particlesimulator.git
   cd particlesimulator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173` (or the port shown in your terminal).

### Building for Production

To build the project for production:

```bash
npm run build
```

The built files will be in the `dist` directory.

## Deployment

This project is set up for automatic deployment to GitHub Pages using GitHub Actions.

### Setup

1. Push your code to GitHub in a repository named `particlesimulator`.

2. Enable GitHub Pages:
   - Go to your repository's Settings
   - Navigate to Pages
   - Select "GitHub Actions" as the source

3. The GitHub Action will automatically build and deploy the site when you push to the main branch.

## License

MIT
