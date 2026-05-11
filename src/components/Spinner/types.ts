/** Modes the main spinner can be in. Controls glyph and shimmer animation behavior. */
export type SpinnerMode =
  | 'responding'
  | 'thinking'
  | 'tool-use'
  | 'tool-input'
  | 'requesting'

export interface RGBColor {
  r: number
  g: number
  b: number
}
