/** The law firm's logo (or its name when it has none), at the top of pages its clients see. */
export function FirmBrand({ name, logo }: { name: string; logo: string | null }) {
  if (!logo) return <p className="text-lg font-semibold">{name}</p>;
  return (
    // A small image the firm uploaded, served by our own route: next/image adds nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt={name} className="h-10 w-auto max-w-[220px] object-contain object-left" />
  );
}
