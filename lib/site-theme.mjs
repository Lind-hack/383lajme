export const THEME_KEY = "383-theme";
export const THEME_COOKIE = "383_theme";
export function normalizeTheme(value) { return value === "dark" ? "dark" : "light"; }
export const themeBootstrap = `(function(){var t;try{t=localStorage.getItem('383-theme')}catch(e){}if(t!=='dark'&&t!=='light'){try{var m=document.cookie.match(/(?:^|; )383_theme=(dark|light)(?:;|$)/);t=m?m[1]:'light'}catch(e){t='light'}}document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t})();`;
