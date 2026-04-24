# Nimit Sevak 🙇🏻‍♂️

A high-performance, warm-minimalist CRM and administrative suite for spiritual and personal management. Built with TanStack Start and Supabase.

## 🚀 Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   Copy `.env.example` to `.env` and provide your Supabase credentials.

3. **Run development server**:
   ```bash
   npm run dev
   ```

## 📐 Project Design & Architecture

For detailed engineering context and coding standards:
- [**DESIGN.md**](file:///Users/kirittanna/projects/nimmit-sevak/DESIGN.md): Architecture, state management, and module specifications.
- [**AGENT_INSTRUCTIONS.md**](file:///Users/kirittanna/projects/nimmit-sevak/AGENT_INSTRUCTIONS.md): Critical patterns and UI protocols for AI coding agents.

## 🛠 Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start)
- **Database/Auth**: [Supabase](https://supabase.com/)
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion
- **Icons**: Lucide React

## 📖 Module Overview

- **Contacts**: Virtualized CRM for managing extensive networks.
- **Attendance**: Session-based tracking with locational context.
- **Smruties (Journal)**: Media-rich chronological logging.
- **Vicharan (Travel)**: Itinerary planning and itinerary mapping.
- **Follow-up Lists**: Dynamic grouping and drafting system for contact outreach.

## 🧪 Testing

```bash
npm run test
```

## 🚢 Deployment

Detailed deployment instructions can be found in [.agent/workflows/deploy-netlify.md](file:///Users/kirittanna/projects/nimmit-sevak/.agent/workflows/deploy-netlify.md).