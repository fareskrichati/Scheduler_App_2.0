(function redirectPhoneVisitors() {
  const path = window.location.pathname;
  const fileName = path.split("/").pop() || "index.html";
  const params = new URLSearchParams(window.location.search);
  const wantsDesktop = params.get("view") === "desktop";
  const alreadyMobile = fileName.toLowerCase() === "mobile.html";
  const narrowScreen = window.matchMedia("(max-width: 760px)").matches;
  const touchDevice = window.matchMedia("(pointer: coarse)").matches;

  if (!alreadyMobile && !wantsDesktop && narrowScreen && touchDevice) {
    const mobileUrl = new URL("mobile.html", window.location.href);
    mobileUrl.search = window.location.search;
    mobileUrl.hash = window.location.hash;
    window.location.replace(mobileUrl);
  }
})();
