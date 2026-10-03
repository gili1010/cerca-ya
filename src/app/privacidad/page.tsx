import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { DetailShell } from "@/components/details/detail-shell";
import styles from "./privacy.module.css";

export const metadata: Metadata = {
  title: "Política de Privacidad | CercaYa",
  description: "Cómo CercaYa utiliza y protege la información de tu cuenta, ubicación, comercios, pedidos, ofertas y reservas.",
};

export default function PrivacyPage() {
  return <DetailShell>
    <article className={styles.page} aria-labelledby="privacy-title">
      <Link className="secondary-link" href="/"><ArrowLeft size={16} aria-hidden="true" />Volver a CercaYa</Link>
      <header className={styles.heading}>
        <span className={styles.icon}><ShieldCheck size={28} aria-hidden="true" /></span>
        <span className="eyebrow">TU INFORMACIÓN, CON CLARIDAD</span>
        <h1 id="privacy-title">Política de Privacidad</h1>
        <p>En CercaYa conectamos lo que necesitás con los comercios que lo tienen cerca. Acá te contamos qué información usamos y para qué.</p>
        <p className={styles.updated}>Última actualización: <time dateTime="2026-10-01">1 de octubre de 2026</time></p>
      </header>

      <div className={`panel ${styles.content}`}>
        <section aria-labelledby="privacy-data">
          <h2 id="privacy-data">1. Qué información recopilamos</h2>
          <p>Recibimos la información que ingresás al crear tu cuenta o usar CercaYa: nombre, email, teléfono si lo proporcionás, datos de tu comercio, productos, fotos, Pedidos Abiertos, ofertas y reservas. También utilizamos identificadores y datos de sesión necesarios para reconocer tu cuenta.</p>
          <p>Podés explorar el catálogo sin crear una cuenta. Algunas acciones, como publicar un pedido, ofrecer un producto o reservar, requieren iniciar sesión.</p>
        </section>

        <section aria-labelledby="privacy-account">
          <h2 id="privacy-account">2. Nombre, email y autenticación</h2>
          <p>Usamos tu nombre para identificar tu perfil y tu email para autenticarte, confirmar tu cuenta y gestionar comunicaciones necesarias relacionadas con el acceso. El email de tu cuenta no se publica como parte del catálogo.</p>
          <p>Supabase proporciona la autenticación y el almacenamiento de los datos de CercaYa. Cuando utilizás email y contraseña, Supabase gestiona las credenciales y la sesión.</p>
          <p><strong>Si iniciás sesión con Google, CercaYa recibe únicamente la información básica necesaria para autenticarte, como nombre, email e identificador de cuenta, según los permisos que concedas.</strong> No necesitamos acceso a tus correos, contactos ni archivos de Google para autenticarte.</p>
          <p>Google gestiona la autenticación de tu cuenta de Google; CercaYa utiliza esa identidad a través de Supabase. Podés revisar los permisos concedidos desde tu cuenta de Google.</p>
        </section>

        <section aria-labelledby="privacy-location">
          <h2 id="privacy-location">3. Tu ubicación es opcional</h2>
          <p>Accedemos a la ubicación del dispositivo sólo cuando elegís usarla y autorizás el permiso del navegador. Puede ser aproximada o precisa, según el dispositivo y los permisos concedidos. No la solicitamos de forma automática para explorar el catálogo ni hacemos seguimiento continuo de tus movimientos.</p>
          <p>La usamos para calcular distancias aproximadas en línea recta, ordenar productos por cercanía y aplicar los filtros de distancia disponibles. Para el catálogo, la última ubicación, localidad y fecha de actualización se conservan localmente en tu navegador entre sesiones, hasta que las elimines; no se guardan en Supabase por ese uso.</p>
          <p>Si elegís incluir tu ubicación al publicar un Pedido Abierto, sus coordenadas se guardan asociadas a ese pedido para calcular distancias y mostrarlo a comercios dentro del radio solicitado. La respuesta del Radar a los comercios incluye la distancia, sin devolver las coordenadas del comprador.</p>
          <p>Podés explorar o publicar un pedido sin ubicación. La opción “Dejar de usar ubicación” elimina la ubicación guardada localmente para el catálogo; no modifica la que ya incluiste en un pedido publicado. También podés revocar el permiso desde la configuración de tu navegador.</p>
        </section>

        <section aria-labelledby="privacy-business">
          <h2 id="privacy-business">4. Comercios y productos</h2>
          <p>Cuando registrás un comercio, utilizamos su nombre, descripción, categorías, ciudad, dirección, WhatsApp y opciones de retiro o envío. Si autorizás guardar su ubicación, la usamos para calcular la distancia a los compradores y a los pedidos.</p>
          <p>Los datos comerciales y de los productos activos se muestran en el catálogo público para que los compradores puedan encontrar el comercio: nombres, descripciones, fotos, precios, disponibilidad, stock y última confirmación. Las imágenes publicadas son accesibles públicamente.</p>
          <p>Publicá únicamente información e imágenes que quieras compartir. La ubicación del comercio se utiliza para informar cercanía y no tiene el mismo carácter privado que las coordenadas de un comprador en un Pedido Abierto.</p>
        </section>

        <section aria-labelledby="privacy-activity">
          <h2 id="privacy-activity">5. Pedidos Abiertos, ofertas y reservas</h2>
          <p>Guardamos el contenido, la categoría, la urgencia, el radio, las fechas y el estado de tus Pedidos Abiertos. Los comercios habilitados pueden ver los datos necesarios para responder mediante Radar. Evitá incluir datos sensibles o una dirección privada en la descripción del pedido.</p>
          <p>Las ofertas incluyen comercio, producto, descripción, precio, disponibilidad, modalidad de entrega o retiro y estado. Se utilizan para que el comprador consulte las propuestas y el comercio gestione las que envió.</p>
          <p>Las reservas guardan el producto, comercio, cantidad, precios, modalidad, fechas y estado. El comprador y el comercio correspondiente pueden consultar la información necesaria para gestionar esa reserva.</p>
          <p>Si abrís un enlace de WhatsApp, salís de CercaYa para contactar al comercio. El mensaje preparado puede incluir el nombre del producto u otros detalles de la consulta; se envía sólo si vos lo confirmás en WhatsApp.</p>
        </section>

        <section aria-labelledby="privacy-sharing">
          <h2 id="privacy-sharing">6. Cómo usamos y compartimos los datos</h2>
          <p>Utilizamos la información para operar el marketplace, mantener tu sesión, mostrar el catálogo, calcular cercanía y gestionar pedidos, ofertas y reservas. Compartimos con los participantes de cada operación la información necesaria para esas funciones y publicamos los datos comerciales que forman parte del catálogo.</p>
          <p><strong>No vendemos tus datos personales.</strong> Supabase procesa información para prestar los servicios de autenticación y almacenamiento. Google interviene cuando elegís ese método de acceso. Estos proveedores aplican sus propias políticas a los servicios que prestan.</p>
          <p>Aplicamos controles de acceso para limitar la consulta y modificación de los datos según la cuenta y su relación con cada pedido, oferta o reserva. Conservamos la información mientras sea necesaria para prestar el servicio y gestionar las operaciones; ante una solicitud de eliminación evaluamos qué datos pueden borrarse y si existe alguna obligación de conservar información.</p>
        </section>

        <section aria-labelledby="privacy-session">
          <h2 id="privacy-session">7. Cookies y almacenamiento de sesión</h2>
          <p>Usamos cookies y mecanismos de sesión necesarios para autenticarte, mantener el acceso y proteger las páginas de tu cuenta. El navegador también puede conservar información de sesión, como la ubicación que autorizaste para el catálogo.</p>
          <p>Esta página no incorpora cookies nuevas, publicidad ni herramientas de tracking. Podés administrar o borrar las cookies y el almacenamiento desde tu navegador; hacerlo puede cerrar tu sesión o eliminar preferencias guardadas en ese dispositivo.</p>
        </section>

        <section aria-labelledby="privacy-contact">
          <h2 id="privacy-contact">8. Contacto y eliminación de cuenta o datos</h2>
          <p>Podés solicitar la eliminación de tu cuenta y de tus datos personales, o consultar sobre su uso. Para tramitar una solicitud podemos necesitar verificar que sos la persona titular de la cuenta; nunca te pediremos tu contraseña.</p>
          <p>Escribinos a <a href="mailto:lucianog_332@hotmail.com">lucianog_332@hotmail.com</a> para consultas de privacidad o solicitudes de eliminación de cuenta y datos. Indicá el email asociado a tu cuenta y qué necesitás solicitar, sin enviar contraseñas ni información sensible innecesaria.</p>
        </section>

        <section aria-labelledby="privacy-changes">
          <h2 id="privacy-changes">9. Actualizaciones de esta política</h2>
          <p>Podemos actualizar esta política cuando cambien los servicios o la forma de utilizar la información. La versión vigente estará disponible en esta página, con su fecha de actualización.</p>
        </section>
      </div>
    </article>
  </DetailShell>;
}
