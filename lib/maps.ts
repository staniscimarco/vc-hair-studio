/** Link di navigazione verso un indirizzo: Apple Mappe (iPhone) e Google Maps. */
export function appleMapsUrl(address: string) {
  return `https://maps.apple.com/?daddr=${encodeURIComponent(address)}&dirflg=d`;
}

export function googleMapsUrl(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}
