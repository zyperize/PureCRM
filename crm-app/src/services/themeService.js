import { getWorkspaceConfig } from './workspaceConfig'

const ACCENT_PALETTES = {
  gold: ['#f9f5d7', '#f3e5ab', '#e6c86e', '#d4af37', '#c5a028', '#a3841f', '#826818'],
  blue: ['#dbeafe', '#bfdbfe', '#93c5fd', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af'],
  emerald: ['#d1fae5', '#a7f3d0', '#6ee7b7', '#10b981', '#059669', '#047857', '#065f46'],
  violet: ['#ede9fe', '#ddd6fe', '#c4b5fd', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6'],
  rose: ['#ffe4e6', '#fecdd3', '#fda4af', '#f43f5e', '#e11d48', '#be123c', '#9f1239'],
}

function resolvedAppearance(value) {
  if (value === 'light' || value === 'dark') return value
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function applyWorkspaceTheme(config = getWorkspaceConfig()) {
  const root = document.documentElement
  const palette = ACCENT_PALETTES[config.accent] || ACCENT_PALETTES.gold
  const appearance = resolvedAppearance(config.appearance)

  root.dataset.theme = appearance
  root.dataset.accent = config.accent || 'gold'
  palette.forEach((color, index) => {
    root.style.setProperty(`--color-gold-${(index + 1) * 100}`, color)
  })

  return appearance
}

export function watchSystemTheme() {
  const media = window.matchMedia?.('(prefers-color-scheme: light)')
  if (!media) return () => {}
  const listener = () => {
    if (getWorkspaceConfig().appearance === 'system') applyWorkspaceTheme()
  }
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}

export const accentOptions = Object.entries(ACCENT_PALETTES).map(([id, colors]) => ({
  id,
  color: colors[3],
  label: id[0].toUpperCase() + id.slice(1),
}))
