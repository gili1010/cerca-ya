import { RequestShell } from "@/components/requests/request-shell";
import { MerchantWorkspace } from "@/components/radar/merchant-workspace";

export const metadata = { title: "Panel del comercio | CercaYa" };
export default function Page() { return <RequestShell business realRequests><MerchantWorkspace /></RequestShell>; }

