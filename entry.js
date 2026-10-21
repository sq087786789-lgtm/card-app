// Replace the former cache-first worker only within this repository's scope.
// Leave old IndexedDB records and photo caches available for local recovery.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', {updateViaCache: 'none'})
    .then(registration => registration.update()).catch(() => {});
}
