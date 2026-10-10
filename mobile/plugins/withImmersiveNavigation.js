'use strict';

// Native-only Android immersive navigation for the ReconFeed three-button beta.
// Expo SDK 54 enforces edge-to-edge, so the legacy navigation bar config flags
// do not reliably provide transient system bars. Patch the generated activity
// during CNG/prebuild; leave the iOS and web implementations unchanged.
const { withMainActivity, withAppDelegate } = require('expo/config-plugins');

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
    'import android.view.View',
    'import androidx.core.view.WindowCompat',
    'import androidx.core.view.WindowInsetsCompat',
    'import androidx.core.view.WindowInsetsControllerCompat',
  ].join('\n');
  let output = contents.replace(importAnchor, match => match + '\n' + imports);

  // Hide only Android's device navigation controls. The status bar remains
  // visible, and the app's own tab bar is unaffected.
  const nativeMethods = `
  private fun applyReconFeedImmersiveNavigation() {
    @Suppress("DEPRECATION")
    window.decorView.systemUiVisibility = window.decorView.systemUiVisibility or (
      View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
        View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
    )
    val controller = WindowCompat.getInsetsController(window, window.decorView)
    controller.systemBarsBehavior =
      WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    controller.hide(WindowInsetsCompat.Type.navigationBars())
  }

  override fun onResume() {
    super.onResume()
    window.decorView.post { applyReconFeedImmersiveNavigation() }
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) window.decorView.post { applyReconFeedImmersiveNavigation() }
  }
`;
  output = output.replace(classAnchor, match => match + '\n' + nativeMethods);
  output = output.replace(onCreateAnchor, match => match + '\n    window.decorView.post { applyReconFeedImmersiveNavigation() }');
  return output;
}

function patchIosAppDelegate(source) {
  if (source.includes('final class ReconFeedImmersiveRootViewController: UIViewController')) return source;
  const anchor = 'class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {';
  if (!source.includes(anchor)) throw new Error('ReconFeed: unsupported iOS AppDelegate template');
  const override = [
    '  override func createRootViewController() -> UIViewController {',
    '    return ReconFeedImmersiveRootViewController(contentController: super.createRootViewController())',
    '  }'
  ].join('\n');
  const wrapper = [
    'final class ReconFeedImmersiveRootViewController: UIViewController {',
    '  private let contentController: UIViewController',
    '  init(contentController: UIViewController) {',
    '    self.contentController = contentController',
    '    super.init(nibName: nil, bundle: nil)',
    '  }',
    '  required init?(coder: NSCoder) { fatalError("ReconFeed immersive root is programmatic") }',
    '  override func viewDidLoad() {',
    '    super.viewDidLoad()',
    '    view.backgroundColor = .black',
    '    addChild(contentController)',
    '    contentController.view.frame = view.bounds',
    '    contentController.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]',
    '    view.addSubview(contentController.view)',
    '    contentController.didMove(toParent: self)',
    '  }',
    '  override var prefersHomeIndicatorAutoHidden: Bool { true }',
    '  override var childForStatusBarStyle: UIViewController? { contentController }',
    '  override var childForStatusBarHidden: UIViewController? { contentController }',
    '}'
  ].join('\n');
  return source.replace(anchor, anchor + '\n' + override) + '\n' + wrapper + '\n';
}

function withReconFeedImmersiveNavigation(config) {
  config = withMainActivity(config, mod => {
    if (!['kt', 'kotlin'].includes(mod.modResults.language)) {
      throw new Error('ReconFeed immersive navigation requires the Kotlin Expo Android activity.');
    }
    mod.modResults.contents = patchMainActivity(mod.modResults.contents);
    return mod;
  });
  return withAppDelegate(config, mod => {
    if (mod.modResults.language !== 'swift') throw new Error('ReconFeed: requires Swift AppDelegate');
    mod.modResults.contents = patchIosAppDelegate(mod.modResults.contents);
    return mod;
  });
}

module.exports = withReconFeedImmersiveNavigation;
module.exports.patchMainActivity = patchMainActivity;

module.exports.patchIosAppDelegate = patchIosAppDelegate;
