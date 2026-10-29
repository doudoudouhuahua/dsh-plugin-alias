/**
 * Host half of dsh-plugin-alias.
 *
 * The feature lives entirely in the browser half (lib/client.js): it contributes
 * a tab to the Plugins page and rewrites bundle card titles. This host row only
 * exists so the package is a loadable bundle in the profile.
 */
export const name = 'dsh-plugin-alias'

export function apply() {
  // Intentionally empty: no host-side services, tools, or listeners.
}
