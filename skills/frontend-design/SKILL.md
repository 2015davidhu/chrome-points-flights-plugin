---
name: frontend-design
description: Use when the user asks to build or restyle a website, landing page, dashboard, React component, HTML/CSS layout, poster-like web artifact, or any frontend UI where visual quality matters. This skill guides creation of distinctive, production-grade interfaces with a strong aesthetic point of view, avoiding generic AI-looking design.
---

# Frontend Design

## Overview

Use this skill to design and implement frontend interfaces that feel intentional, memorable, and production-ready. The goal is not generic prettiness; it is a coherent visual thesis executed with precision.

## Workflow

### 1. Set the visual thesis before coding

Decide the interface's point of view up front:

- Purpose: what the interface is for and what the user needs to do
- Audience: who it is for and what tone fits them
- Aesthetic direction: pick one clear lane and commit
- Memorability: identify the one thing the user should remember

Good directions include editorial, refined luxury, brutalist, retro-futurist, toy-like, organic, industrial, or art-deco-inspired. Do not blend several conflicting moods unless the brief explicitly calls for that tension.

### 2. Design with strong opinions

Make concrete aesthetic choices early:

- Typography: pair a distinctive display face with a readable body face
- Color: build around a dominant palette with one or two sharp accents
- Composition: use asymmetry, overlap, spacing, and scale deliberately
- Motion: prefer a few meaningful moments over many weak micro-interactions
- Atmosphere: use gradients, texture, shapes, borders, grain, shadows, or pattern when they support the concept

Use CSS variables for theme consistency.

### 3. Avoid generic AI UI

Do not default to:

- Inter, Roboto, Arial, or generic system stacks unless the product already uses them
- purple-on-white gradient aesthetics
- safe SaaS dashboard layouts with interchangeable cards
- bland centered hero + feature grid patterns without a visual idea
- decorative motion that does not improve the experience

If the current direction looks common, push it further or choose a more specific one.

### 4. Match complexity to the concept

- Maximalist concepts should have richer layout systems, detail, and motion
- Minimalist concepts should be restrained, spacious, and exacting
- Preserve the existing design system when working inside an established product

The output must still be functional, responsive, and readable.

### 5. Ship production-grade frontend

Implement real working code, not mockup fragments.

Always ensure:

- desktop and mobile layouts both work
- hierarchy is obvious at a glance
- hover, focus, and loading states feel intentional
- accessibility is not broken by the visual treatment
- code structure is maintainable and consistent with the stack in use

## Execution Standards

When building the UI:

- Start from a bold concept, not from a component library default
- Carry the concept through type, color, layout, and motion
- Prefer one strong visual system over many disconnected embellishments
- Make every visible detail feel chosen

When working in React:

- keep the implementation idiomatic for the repo
- do not add unnecessary memoization
- use animation libraries only when the project already supports them or the payoff is clear

## Response Pattern

In your implementation notes, briefly state:

- the chosen aesthetic direction
- the main visual decisions
- any deliberate tradeoffs made for responsiveness, accessibility, or performance

Keep this short. Spend effort on the interface itself.
