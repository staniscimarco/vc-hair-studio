import { MapPin } from "lucide-react";
import { CITY, POSTAL_CODE } from "@/lib/validators";

/** Via e civico; città e CAP sono fissi perché il servizio copre solo Brindisi. */
export function AddressField({ defaultValue = "", name = "indirizzo" }: { defaultValue?: string; name?: string }) {
  return (
    <label className="field">
      Indirizzo
      <span className="address-input">
        <MapPin size={18} aria-hidden />
        <input name={name} defaultValue={defaultValue} placeholder="Via e numero civico" autoComplete="address-line1" required />
        <span className="address-suffix">{POSTAL_CODE} {CITY}</span>
      </span>
      <small className="text-[11px] font-normal text-muted">Serviamo solo Brindisi ({POSTAL_CODE}).</small>
    </label>
  );
}
