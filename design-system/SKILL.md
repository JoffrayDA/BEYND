---
name: beynd-design
description: Use this skill to generate well-branded interfaces and assets for BEYND, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

Key things to remember about BEYND:
- Conversational coaching app — chat is the primary surface, not a bolt-on feature.
- 3 coach personas, each with a full visual theme: Max/Cool-jeune (cream + burnt orange), Sam/Pote-cash (clean white + vivid blue), Nova/Data-Nerd (dark + neon cyan). Apply via `data-theme` on a container, driven by `tokens/colors.css`.
- Tone: "tu" address, direct but warm, never pastel-wellness, never hardcore/warrior. Emoji only in Max's chat messages, never in chrome.
- No source font/logo/icon assets were provided — Inter + Bricolage Grotesque (Google Fonts) and Lucide icons are flagged substitutions; ask the user for real assets if precision matters.
