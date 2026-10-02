export interface IosInstallContext {
  device: "iphone" | "ipad";
  browser: "safari" | "chrome" | "firefox" | "edge" | "other";
  supported: boolean;
  sharePlace: string;
}
export function iosInstallContext(ua: string, touchPoints?: number): IosInstallContext | null;
