---
version: alpha
name: Margin
description: A calm notes app for people who think in drafts.
colors:
  ink: "#141413"
  muted: "#5E5D59"
  surface: "#FFFFFF"
  canvas: "#F4F3F0"
  line: "#E4E2DD"
  accent: "#C2410C"
  accent-ink: "#FFFFFF"
typography:
  display:
    fontFamily: Inter
    fontSize: 44px
    fontWeight: 650
    lineHeight: 1.05
    letterSpacing: -0.03em
  title:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 600
  body:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 400
  label:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 500
  mono:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: 500
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
  4xl: 64px
rounded:
  sm: 6px
  md: 10px
  lg: 16px
  full: 9999px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.md}"
    padding: 12px
---

# Margin

## Overview

Margin is quiet software. The page should feel like good paper: warm canvas, white sheets, one orange accent used only for the next action.

## Colors

- **Ink** for all primary text. **Muted** for secondary text, only on surface or canvas.
- **Accent** marks the single primary action on a screen. Never for decoration, never for links in body text.

## Typography

Inter for everything except metadata, which uses JetBrains Mono at 12px. Headlines are tight (-0.03em); body text is never below 15px.

## Layout

Spacing comes from the 4px scale only. Cards sit on the canvas with a 1px line and no shadow.

## Shapes

Cards use `rounded.lg`, buttons `rounded.md`, chips `rounded.full`.
