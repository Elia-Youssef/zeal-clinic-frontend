/**
 * The clinic's logo as a real image, so it stays visible in forced-colours and
 * high-contrast modes where background images disappear. Decorative wherever
 * it shows: the clinic's name or the loading status beside it says what a
 * screen reader needs. It fills the box its parent sizes.
 */
export function ClinicLogo() {
  return <img src="/zeal.png" alt="" className="size-full object-cover" />;
}
