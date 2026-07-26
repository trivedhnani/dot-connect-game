import { u } from './theme'

// env(safe-area-inset-*) measured via a probe element; 0 in browsers/node.
function cssEnv(name: string): number {
  if (typeof document === 'undefined' || !document.body) return 0
  const el = document.createElement('div')
  el.style.cssText = `position:fixed;top:0;left:0;width:0;visibility:hidden;height:env(${name},0px)`
  document.body.appendChild(el)
  const v = el.getBoundingClientRect().height
  el.remove()
  return v
}
export const SAFE = {
  top: u(cssEnv('safe-area-inset-top')),
  bottom: u(cssEnv('safe-area-inset-bottom')),
}
