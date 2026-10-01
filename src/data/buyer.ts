import { DEMO_BUYER_ID } from "./businesses";
import type { ReservationBuyer } from "@/types/reservations";

// Replace this adapter with the authenticated buyer when accounts are introduced.
export const demoBuyer: ReservationBuyer = { id: DEMO_BUYER_ID, name: "Cliente Demo", phone: "3510000000" };
