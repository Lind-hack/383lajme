// Toni moved into Bota për Kosovën.
//
// The site used to carry two separate surfaces over one pipeline: "Bota Flet"
// (the translated foreign headlines) and "Toni i Mediave" (the analysis of
// those same headlines). A newcomer had to discover on their own that the two
// were related, and neither name said what it was. They are now one
// destination with the coverage first and the analysis under it.
//
// This redirect is permanent and stays: /toni is indexed, is linked from old
// articles and from the side panel, and a 404 would throw away every one of
// those readers. Next emits a 308, so search engines transfer the ranking
// rather than treating it as a new page.

import { permanentRedirect } from "next/navigation";

export default function ToniPage() {
  permanentRedirect("/bota-per-kosoven");
}
