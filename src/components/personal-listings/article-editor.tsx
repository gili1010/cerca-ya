"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight, Check, CircleCheck, Save } from "lucide-react";
import { BackLink } from "@/components/navigation/back-link";
import { FormError } from "@/components/requests/request-common";
import { provinceByCode } from "@/lib/argentina-provinces";
import { articlePrice } from "@/lib/personal-listings/form";
import type { PersonalListingPresentation } from "@/types/personal-listings";
import { ArticlePhotos } from "./article-photos";
import { ArticleLocality } from "./article-locality";
import { ArticlePresentation } from "./article-presentation";
import { useArticleEditor } from "./use-article-editor";
import { useSignedPersonalPhotos } from "./use-signed-photos";
import styles from "./personal-listings.module.css";

const steps = ["Datos", "Fotos", "Contacto", "Revisar"];
type Editor = ReturnType<typeof useArticleEditor>;

function ArticlePreview({ editor }: { editor: Editor }) {
  const signed = useSignedPersonalPhotos(editor.photos.flatMap(photo => photo.path ? [photo.path] : []));
  const urls = { ...signed.urls };
  const photos = editor.photos.map((photo, position) => {
    const path = photo.path ?? `preview-${photo.key}`;
    if (photo.localUrl) urls[path] = photo.localUrl;
    return { id: photo.key, object_path: path, position };
  });
  const { form, base } = editor;
  const preview: PersonalListingPresentation = {
    id: base?.id ?? "", category_id: form.categoryId, category_name: editor.categories.find(category => category.id === form.categoryId)?.name ?? "",
    category_slug: "", title: form.title, description: form.description, price: articlePrice(form.price) ?? 0,
    currency: "ARS", negotiable: form.negotiable, item_condition: form.condition,
    seller_display_name: form.publicName, contact_method: form.consent ? "WHATSAPP" : "NONE", contact_whatsapp: form.consent ? form.whatsapp : null,
    city: form.city, province: provinceByCode(form.provinceCode)?.name ?? "", province_code: form.provinceCode, country_code: "AR",
    created_at: base?.created_at ?? "", updated_at: base?.updated_at ?? "", published_at: base?.published_at ?? null, expires_at: base?.expires_at ?? null, images: photos,
  };
  return <><ArticlePresentation listing={preview} photoUrls={urls} preview />{signed.error && <p className={styles.hint}>{signed.error}<button className="secondary-link" type="button" onClick={signed.refresh}>Volver a cargar fotos</button></p>}</>;
}

export function ArticleEditor({ listingId }: { listingId?: string }) {
  const editor = useArticleEditor(listingId);
  const { form, base, locked, busy, step } = editor;
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (editor.error) errorRef.current?.focus(); }, [editor.error]);
  if (editor.loading) return <p className="workflow-loading" role="status">Preparando tu publicación…</p>;
  if (editor.missing) return <section className={`panel ${styles.empty}`}><h1>Esta publicación no está disponible para tu cuenta.</h1><Link className="primary-button" href="/mis-publicaciones">Ir a Mis publicaciones</Link></section>;
  if (editor.success && base) return <section className={`panel ${styles.success}`}><span className={styles.symbol}><CircleCheck size={34} aria-hidden="true" /></span><h1>{listingId ? "Tu artículo está actualizado." : "¡Tu artículo ya está publicado!"}</h1><p>Ya podés compartirlo con alguien de tu localidad.</p><div className={styles.actions}><Link className="primary-button" href={`/articulo/${base.id}`}>Ver publicación</Link><Link className="outline-button" href="/mis-publicaciones">Mis publicaciones</Link></div></section>;
  return <div className={styles.wizard}><BackLink href="/mis-publicaciones">Mis publicaciones</BackLink>
    <div className={styles.heading}><span className="eyebrow">PUBLICACIÓN PARTICULAR</span><h1>{listingId ? "Editar mi artículo" : "Vendé algo cerca tuyo"}</h1><p>Sin tienda, sin stock y sin vueltas. Mostrá tu artículo y coordiná directamente con quien te consulte.</p></div>
    {editor.suspended && <p className="form-error">Tu cuenta está suspendida. Podés consultar tus publicaciones, pero no modificarlas.</p>}
    {base?.admin_blocked && <p className="form-error">Esta publicación está bloqueada por administración.{base.admin_block_reason && ` Motivo: ${base.admin_block_reason}`} No podés editarla ni reactivarla.</p>}
    {editor.terminal && <div className={styles.notice}>Esta publicación está {base?.status === "SOLD" ? "vendida" : "retirada"} y no se puede reactivar. <Link className="secondary-link" href={`/mis-publicaciones/${base?.id}`}>Ver publicación guardada</Link></div>}
    {base?.status === "PUBLISHED" && !base.admin_blocked && !editor.suspended && <div className={styles.notice}>Tu artículo está publicado. Los cambios se actualizan al guardar o continuar. Para quitar el contacto o la última foto, pausalo primero.<br /><button className="outline-button button-sm" type="button" disabled={locked} onClick={editor.pause}>Pausar publicación</button></div>}
    {base?.expired && <label className={`${styles.notice} ${styles.check}`}><input type="checkbox" checked={form.renew} disabled={locked} onChange={event => editor.change("renew", event.target.checked)} /><span>La publicación venció. Quitar el vencimiento para volver a publicarla.</span></label>}
    {editor.notice && <div className={styles.notice} role="status">{editor.notice}{base && !listingId && <><br /><Link className="secondary-link" href={`/mis-publicaciones/${base.id}/editar`}>Abrir este borrador</Link>{!editor.dirty && <button className="secondary-link" type="button" disabled={locked} onClick={editor.startAnother}>Empezar otro artículo</button>}</>}</div>}
    <div ref={errorRef} tabIndex={-1}><FormError message={editor.error} />{editor.frozen && <div className={styles.notice}>Revisá el estado guardado antes de continuar. Al recargar se reemplazan los cambios locales por los datos guardados.<br /><button className="outline-button" type="button" disabled={busy} onClick={editor.reload}>Recargar publicación</button></div>}</div>
    {editor.pendingCleanup.length > 0 && <div className={styles.notice}>Hay fotos anteriores pendientes de limpieza. No se muestran como fotos del anuncio.<br /><button className="outline-button button-sm" type="button" disabled={locked} onClick={editor.retryCleanup}>Reintentar limpieza</button></div>}
    <ol className={styles.progress} aria-label="Progreso de publicación">{steps.map((label, index) => <li key={label} aria-current={index === step ? "step" : undefined} data-done={index < step}><b>{index < step ? <Check size={16} aria-hidden="true" /> : index + 1}</b><span>{label}</span></li>)}</ol>
    <form className={`panel ${styles.formPanel}`} noValidate onSubmit={event => { event.preventDefault(); if (step === 3) editor.publish(); else editor.next(); }} aria-busy={busy || editor.preparing}>
      <fieldset disabled={locked}><legend>{["Contanos sobre el artículo", "Que se vea bien", "Cómo pueden contactarte", "Así se verá tu publicación"][step]}</legend>
      {step === 0 && <><label className={styles.field}>Título del artículo<input value={form.title} maxLength={160} required placeholder="Ej. Bicicleta rodado 26 en buen estado" onChange={event => editor.change("title", event.target.value)} /></label>
        <label className={styles.field}>Descripción<textarea value={form.description} maxLength={5000} placeholder="Contá su estado, medidas y cualquier detalle que ayude a elegir." onChange={event => editor.change("description", event.target.value)} /><small>{form.description.length}/5.000 caracteres</small></label>
        <label className={styles.field}>Categoría<select value={form.categoryId} required onChange={event => editor.change("categoryId", event.target.value)}><option value="">Elegí una categoría</option>{editor.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        {!editor.categories.length && <p className="form-error">No pudimos encontrar categorías disponibles. <button className="secondary-link" type="button" onClick={editor.reload}>Reintentar</button></p>}
        <div className={styles.fields}><label className={styles.field}>Condición<select value={form.condition} onChange={event => editor.change("condition", event.target.value === "NEW" ? "NEW" : "USED")}><option value="USED">Usado</option><option value="NEW">Nuevo</option></select></label>
          <label className={styles.field}>Precio · pesos argentinos<input value={form.price} inputMode="decimal" required placeholder="Ej. 45000" onChange={event => editor.change("price", event.target.value)} /><small>Sin puntos de miles. Podés usar coma para los decimales.</small></label></div>
        <label className={styles.check}><input type="checkbox" checked={form.negotiable} onChange={event => editor.change("negotiable", event.target.checked)} />Precio negociable</label>
        <ArticleLocality province={form.provinceCode} city={form.city} disabled={locked} onProvince={value => { editor.change("provinceCode", value); editor.change("city", ""); }} onCity={value => editor.change("city", value)} />
      </>}
      {step === 1 && <ArticlePhotos photos={editor.photos} disabled={locked} preparing={editor.preparing} onAdd={files => void editor.addPhotos(files)} onChange={editor.changePhotos} />}
      {step === 2 && <><label className={styles.field}>Nombre público <span className={styles.hint}>Opcional</span><input value={form.publicName} maxLength={120} autoComplete="off" placeholder="Cómo querés aparecer en tu anuncio" onChange={event => editor.change("publicName", event.target.value)} /></label>
        <label className={styles.field}>WhatsApp · Argentina (+54)<input value={form.whatsapp} type="tel" inputMode="tel" autoComplete="off" maxLength={40} placeholder="Ej. 3547 123456" onChange={event => { editor.change("whatsapp", event.target.value); editor.change("consent", false); }} /><small>Incluí código de área, sin 0 ni 15. Agregamos +54 cuando corresponda.</small></label>
        <label className={styles.check}><input type="checkbox" checked={form.consent} onChange={event => editor.change("consent", event.target.checked)} /><span>Autorizo a mostrar este número de WhatsApp en mi anuncio público.</span></label>
        <p className={styles.notice}>Tu WhatsApp será visible para las personas que consulten este artículo.</p><p className={styles.hint}>Podés guardar un borrador sin contacto. Si no autorizás el número, no lo guardamos en el anuncio.</p>
      </>}
      {step === 3 && <ArticlePreview editor={editor} />}
      </fieldset>
      {!editor.terminal && <div className={styles.wizardActions}><button type="button" className="outline-button" disabled={locked} onClick={editor.save}><Save size={18} aria-hidden="true" />{busy ? "Guardando…" : base && base.status !== "DRAFT" ? "Guardar cambios" : "Guardar borrador"}</button>
        <div className={styles.actions}>{step > 0 && <button className="ghost-button" type="button" disabled={locked} onClick={() => { editor.setStep(step === 3 ? 0 : step - 1); }}>{step === 3 ? "Volver a editar" : "Anterior"}</button>}
        <button className="primary-button" type="submit" disabled={locked || !editor.categories.length}>{busy ? "Guardando…" : step === 3 ? base?.status === "PUBLISHED" ? "Guardar cambios y ver" : "Publicar artículo" : "Continuar"}{!busy && <ArrowRight size={18} aria-hidden="true" />}</button></div></div>}
    </form>{base && <p className={styles.hint}>Este artículo está guardado en tu cuenta. Podés retomarlo desde <Link className="secondary-link" href="/mis-publicaciones">Mis publicaciones</Link>.</p>}
  </div>;
}
