'use strict';

// Native-only Android immersive navigation for the ReconFeed three-button beta.
// Expo SDK 54 enforces edge-to-edge, so the legacy navigation bar config flags
// do not reliably provide transient system bars. Patch the generated activity
// during CNG/prebuild; leave the iOS and web implementations unchanged.
const { withMainActivity } = require('expo/config-plugins');

function patchMainActivity(contents) {
  if (contents.includes('fun applyReconFeedImmersiveNavigation(')) return contents;

  const classAnchor = /class MainActivity\s*:\s*ReactActivity\(\)\s*\{/;
  const onCreateAnchor = /super\.onCreate\(\s*(?:null|savedInstanceState)\s*\)/;
  const importAnchor = /^import android\.os\.Bundle\s*$/m;
  if (!classAnchor.test(contents) || !onCreateAnchor.test(contents) || !importAnchor.test(contents)) {
    throw new Error('ReconFeed immersive navigation: Expo MainActivity.kt template changed; cannot patch safely.');
  }
  if (contents.includes('override fun onWindowFocusChanged(')) {
    throw new Error('ReconFeed immersive navigation: MainActivity already overrides onWindowFocusChanged.');
  }

  const imports = [
    'import androidx.core.view.WindowCompat',
    'import androidx.core.view.WindowInsetsCompat',
    'import androidx.core.view.WindowInsetsControllerCompat',
  ].join('\n');
  let output = contents.replace(importAnchor, match => match + '\n' + imports);

  // Hide only Android's device navigation controls. The status bar remains
  // visible, and the app's own tab bar is unaffected.
  const nativeMethods = `
  private fun applyReconFeedImmersiveNavigation() {
    val controller = WindowCompat.getInsetsController(window, window.decorView)
    controller.systemBarsBehavior =
      WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    controller.hide(WindowInsetsCompat.Type.navigationBars())
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) applyReconFeedImmersiveNavigation()
  }
`;
  output = output.replace(classAnchor, match => match + '\n' + nativeMethods);
  output = output.replace(onCreateAnchor, match => match + '\n    applyReconFeedImmersiveNavigation()');
  return output;
}

function withReconFeedImmersiveNavigation(config) {
  return withMainActivity(config, mod => {
    if (!['kt', 'kotlin'].includes(mod.modResults.language)) {
      throw new Error('ReconFeed immersive navigation requires the Kotlin Expo Android activity.');
    }
    mod.modResults.contents = patchMainActivity(mod.modResults.contents);
    return mod;
  });
}

module.exports = withReconFeedImmersiveNavigation;
module.exports.patchMainActivity = patchMainActivity;
