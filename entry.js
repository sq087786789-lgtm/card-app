// Replace the former cache-first worker only within this repository's scope.
// Leave old IndexedDB records and photo caches available for local recovery.
// Redirect only the main entry, never the local-data recovery page.
if (document.documentElement.dataset.appEntry === 'redirect') {
  location.replace(document.getElementById('open-library').href);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', {updateViaCache: 'none'})
    .then(registration => registration.update()).catch(() => {});
}
