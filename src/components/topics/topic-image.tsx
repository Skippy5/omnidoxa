import Image from "next/image";

function isRemoteImage(src: string) {
  return src.startsWith("http://") || src.startsWith("https://");
}

export function TopicImage({
  src,
  alt,
  priority = false,
  sizes,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  sizes: string;
}) {
  if (isRemoteImage(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Remote article art is loaded client-side to avoid server-side optimizer SSRF risk.
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover [filter:var(--image-filter)]"
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes}
      className="object-cover [filter:var(--image-filter)]"
    />
  );
}
