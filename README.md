# Lukman Cloud Storage

A high-performance, decentralized virtual file system utilizing modern end-to-end client-side cryptographic key derivation for secure, unlimited cloud storage.

## Overview

**Lukman Cloud** provides a seamless, high-speed, and completely secure file management ecosystem. Built for modern cloud infrastructure, it abstracts away complex storage routing to deliver an elegant, consumer-friendly interface. Data is securely pipelined to a decentralized architecture, ensuring absolute privacy and unmatched performance.

## Core Features

- **Virtual File System:** Instant Copy, Move, and Rename frameworks across complex multi-layered virtual directory trees.
- **Deep Predictive Search:** Instantly locate files across all directories with intelligent autocomplete and deep layout traversal.
- **Live Telemetry:** Dynamic MB/s transfer calculation with precise runtime tracking and progress bars.
- **Unified Quota Mapping:** Intelligent gauge matrix that seamlessly blends multiple storage nodes alongside our unlimited secure data pool into a unified UI.
- **State-of-the-Art Security:** Built with strict schema protections, OAuth isolation, and dual-layer conflict resolution.

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript
- **Styling:** Tailwind CSS
- **Core Processing:** Advanced High-Throughput Service Workers & Supabase Identity
- **Testing:** Playwright E2E Self-Healing Matrix, Vitest
- **Icons:** Lucide React

## Local Installation Guide

1. **Clone the Repository**
   ```bash
   git clone https://github.com/lukmannurh/Lukman-Cloud.git
   cd Lukman-Cloud
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env.local` file in the root directory. Use the provided `.env.example` as a template.
   *Ensure all sensitive keys are kept locally and never committed to version control.*

4. **Start the Development Server**
   ```bash
   npm run dev
   ```
   Navigate to `http://localhost:5173` to access the Lukman Cloud Dashboard.

5. **Run Diagnostics & Production Build**
   ```bash
   npm run build
   ```

## Architecture & Security

Security and scalability are paramount. The architecture ensures that all operational storage mechanics remain abstracted behind a proprietary service-worker layer, routing blocks intelligently without exposing the core protocol to the consumer interface. The application features a robust zero-leak identity layer protected by PostgREST schema constraints.

---
*Developed for unparalleled scalability, reliability, and security.*

## Architecture
- Multi-bot parallel storage matrix architecture
- Virtual File System layout with strict deterministic root tracking
