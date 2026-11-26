// Every feature switch shown in the "Features" card. key = name sent to the Android app's config.json.
export const FEATURE_GROUPS = [
  {
    title: 'Blocking',
    icon: 'shield',
    items: [
      { key: 'adBlock', title: 'Block ads', desc: 'Stops requests to ad and tracker networks', default: true, badge: 'Recommended' },
      { key: 'strongBlocklist', title: 'Extended block list', desc: 'Adds 80,000+ known ad domains', default: true, requires: 'adBlock' },
      { key: 'blockRedirects', title: 'Block redirects', desc: 'Stops jumps to sites you didn\'t tap', default: true },
      { key: 'blockPopups', title: 'Block pop-ups', desc: 'Stops new-tab and pop-under ads', default: true },
    ],
  },
  {
    title: 'Navigation',
    icon: 'compass',
    items: [
      { key: 'pullToRefresh', title: 'Swipe down to refresh', desc: 'Pull the page down to reload it', default: true },
      { key: 'floatingMenu', title: 'Floating menu button', desc: 'Home, refresh, desktop mode, rotate, share', default: true },
      { key: 'doubleBackExit', title: 'Press back twice to exit', desc: 'Prevents closing the app by accident', default: true },
      { key: 'downloads', title: 'File downloads', desc: 'Saves files to the Downloads folder', default: true },
      { key: 'fileUpload', title: 'File uploads', desc: 'Lets the site pick photos and files', default: true },
    ],
  },
  {
    title: 'Display',
    icon: 'phone',
    items: [
      { key: 'desktopMode', title: 'Start in desktop mode', desc: 'Load the desktop version of the site', default: false },
      { key: 'fullscreen', title: 'Fullscreen', desc: 'Hide the status and navigation bars', default: false },
      { key: 'zoom', title: 'Pinch to zoom', desc: 'Zoom with two fingers', default: true },
      { key: 'progressBar', title: 'Loading bar', desc: 'Thin progress line at the top', default: true },
      { key: 'darkMode', title: 'Dark mode', desc: 'Darken websites (Android 13+)', default: false },
    ],
  },
  {
    title: 'Performance & privacy',
    icon: 'bolt',
    items: [
      { key: 'cache', title: 'Cache pages', desc: 'Faster loading for pages you have seen', default: true },
      { key: 'keepScreenOn', title: 'Keep screen on', desc: 'Screen stays awake while the app is open', default: false },
      { key: 'noScreenshot', title: 'Block screenshots', desc: 'Prevents screenshots and screen recording', default: false },
    ],
  },
];

// Switches that only affect the build, not the app's config.json
export const BUILD_ONLY_FEATURES = ['strongBlocklist'];
