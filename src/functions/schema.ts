import { SITE, COMPANY, SNS } from "../config";

export const schema = (description: string): string => {
  const json = {
    "@context": "http://schema.org",
    "@type": "Organization",
    name: COMPANY.name,
    founder: COMPANY.founder,
    foundingDate: COMPANY.foundingDate,
    description: description,
    url: SITE.url,
    logo: `${SITE.url}/logo.svg`,
    address: {
      "@type": "PostalAddress",
      addressLocality: COMPANY.address.addressLocality,
      addressRegion: COMPANY.address.addressRegion,
      postalCode: COMPANY.address.postalCode,
      streetAddress: COMPANY.address.streetAddress,
      addressCountry: COMPANY.address.addressCountry,
    },
    telephone: COMPANY.telephone,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: COMPANY.telephone,
    },
    sameAs: [] as string[],
  };

  if (COMPANY.email) {
    (json as any).email = COMPANY.email;
    (json.contactPoint as any).email = COMPANY.email;
  }

  if (SNS.twitter) json.sameAs.push(`https://twitter.com/${SNS.twitter}`);
  if (SNS.instagram) json.sameAs.push(`https://instagram.com/${SNS.instagram}`);
  if (SNS.facebook) json.sameAs.push(`https://www.facebook.com/${SNS.facebook}`);

  return JSON.stringify(json);
};
