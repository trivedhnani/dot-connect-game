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

// Scenes read SAFE.top/bottom at create() time. WKWebView can report env() as 0 until
// the first layout pass, so we re-measure after load/resize and, if the values changed,
// fire a window resize so live scenes re-anchor (they all listen for it).
export const SAFE = {
  top: u(cssEnv('safe-area-inset-top')),
  bottom: u(cssEnv('safe-area-inset-bottom')),
}

function remeasure(): void {
  const top = u(cssEnv('safe-area-inset-top'))
  const bottom = u(cssEnv('safe-area-inset-bottom'))
  if (top === SAFE.top && bottom === SAFE.bottom) return
  SAFE.top = top
  SAFE.bottom = bottom
  window.dispatchEvent(new Event('resize'))
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', remeasure)
  window.addEventListener('orientationchange', () => setTimeout(remeasure, 100))
  // WKWebView reports env() as 0 for an unpredictable stretch after boot — poll until
  // real insets appear (or give up after ~3s; devices without notches never report any).
  let tries = 0
  const poll = setInterval(() => {
    remeasure()
    if (++tries >= 20 || SAFE.top > 0 || SAFE.bottom > 0) clearInterval(poll)
  }, 150)
}
