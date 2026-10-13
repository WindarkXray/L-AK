/* ==========================================================================
   l'AK vigie — script commun à toutes les pages
   --------------------------------------------------------------------------
   RÉGLAGES : tout ce qu'il faut modifier se trouve juste en dessous.
   ========================================================================== */

/* Lien du Google Sheet (coller tel quel le lien copié depuis le navigateur).
   Le fichier doit être partagé en « Tous les utilisateurs disposant du lien : Lecteur ». */
const LIEN_GOOGLE_SHEET = 'https://docs.google.com/spreadsheets/d/1Hau8arj6TcaRgpi1xvAJzDxewDguFbDePYk39LviLcQ/edit?gid=76090#gid=76090';

/* Facultatif : lien « Demander des avis » de la fiche Google du restaurant.
   Laisser vide pour masquer le bouton « Laisser un avis ». */
const LIEN_LAISSER_AVIS_GOOGLE = '';

/* Clé Web3Forms (reçue par email sur https://web3forms.com) pour recevoir
   les réservations et les messages par email. */
const WEB3FORMS_ACCESS_KEY = '611f3b20-1f0c-49ac-b800-cfba38523f9c';

/* Numéro affiché dans les messages d'erreur des formulaires. */
const TELEPHONE = '+33 6 19 25 32 61';
const TELEPHONE_LIEN = 'tel:+33619253261';

/* ==========================================================================
   À partir d'ici, rien à modifier.
   Astuce : ajouter « ?verif » à la fin de l'adresse d'une page (ex. menu.html?verif)
   affiche un encadré qui dit si le Google Sheet a bien été lu.
   ========================================================================== */

(function () {
    'use strict';

    /* ---------- Ancien site à onglets : on redirige les anciens liens #menu, #contact... ---------- */
    const ANCIENS_ONGLETS = {
        menu: 'menu.html', avis: 'avis.html', equipe: 'equipe.html', evenements: 'evenements.html',
        contact: 'contact.html', reservation: 'reservation.html', mentions: 'mentions-legales.html'
    };
    if (document.body.dataset.page === 'accueil') {
        const ancien = ANCIENS_ONGLETS[location.hash.slice(1)];
        if (ancien) location.replace(ancien);
    }

    /* ---------- Année du pied de page ---------- */
    document.querySelectorAll('[data-annee]').forEach(el => { el.textContent = new Date().getFullYear(); });

    /* =====================================================================
       MENU MOBILE PLEIN ÉCRAN
       ===================================================================== */
    const toggle = document.querySelector('.menu-toggle');
    const nav = document.getElementById('site-nav');
    const closeBtn = nav ? nav.querySelector('.nav-close') : null;
    const autour = [document.querySelector('main'), document.querySelector('.site-footer'),
                    document.querySelector('.site-header .brand'), document.querySelector('.skip-link')].filter(Boolean);
    const ecranLarge = window.matchMedia('(min-width: 1101px)');
    let scrollMemo = 0;

    function bloquerDefilement() {
        scrollMemo = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = -scrollMemo + 'px';
        document.body.style.width = '100%';
    }

    function debloquerDefilement() {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollMemo);
    }

    function ouvrirMenu() {
        if (!nav || nav.classList.contains('is-open')) return;
        nav.classList.add('is-open');
        document.body.classList.add('menu-open');
        toggle.setAttribute('aria-expanded', 'true');
        autour.forEach(el => el.setAttribute('inert', ''));
        bloquerDefilement();
        const premier = nav.querySelector('a');
        if (premier) setTimeout(() => premier.focus({ preventScroll: true }), 60);
    }

    function fermerMenu(rendreFocus) {
        if (!nav || !nav.classList.contains('is-open')) return;
        nav.classList.remove('is-open');
        document.body.classList.remove('menu-open');
        toggle.setAttribute('aria-expanded', 'false');
        autour.forEach(el => el.removeAttribute('inert'));
        debloquerDefilement();
        if (rendreFocus) toggle.focus({ preventScroll: true });
    }

    if (toggle && nav) {
        toggle.addEventListener('click', ouvrirMenu);
        if (closeBtn) closeBtn.addEventListener('click', () => fermerMenu(true));
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') fermerMenu(true);
            // Garde le focus à l'intérieur du menu ouvert
            if (e.key === 'Tab' && nav.classList.contains('is-open')) {
                const items = [...nav.querySelectorAll('a, button')];
                const first = items[0], last = items[items.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        });
        nav.addEventListener('click', e => {
            const lien = e.target.closest('a');
            if (lien && lien.getAttribute('aria-current') === 'page') { e.preventDefault(); fermerMenu(false); }
        });
        const surChangement = () => { if (ecranLarge.matches) fermerMenu(false); };
        if (ecranLarge.addEventListener) ecranLarge.addEventListener('change', surChangement);
        else ecranLarge.addListener(surChangement);
        // Retour arrière depuis une autre page : le menu ne doit pas rester ouvert
        window.addEventListener('pageshow', () => fermerMenu(false));
    }

    /* =====================================================================
       PHOTOS D'ÉVÉNEMENTS : si une photo manque, on garde le fond doré
       ===================================================================== */
    function surveillerPhotos(zone) {
        zone.querySelectorAll('.event-image img').forEach(img => {
            const retirer = () => img.remove();
            if (img.complete && img.naturalWidth === 0) retirer();
            else img.addEventListener('error', retirer, { once: true });
        });
    }
    document.querySelectorAll('.event-gallery').forEach(surveillerPhotos);

    /* =====================================================================
       CONTENU MODIFIABLE PAR LE RESTAURATEUR (Google Sheets)
       La carte, les événements, les horaires et les avis sont lus dans le
       Google Sheet, onglet par onglet, d'après leur NOM. Chaque page ne lit
       que l'onglet dont elle a besoin. Si un onglet est absent ou mal rempli,
       le contenu écrit dans la page reste affiché.
       ===================================================================== */
    const GOOGLE_SHEET_ID = (LIEN_GOOGLE_SHEET.match(/\/d\/([\w-]+)/) || [])[1] || LIEN_GOOGLE_SHEET.trim();
    const etatsVerif = [];

    function sheetUrl(nomOnglet) {
        return 'https://docs.google.com/spreadsheets/d/' + GOOGLE_SHEET_ID +
               '/gviz/tq?tqx=out:csv&headers=1&sheet=' + encodeURIComponent(nomOnglet) +
               '&_=' + Date.now();
    }

    /* "Catégorie " -> "categorie" : majuscules, accents et espaces ne comptent pas */
    function cle(t) {
        return String(t || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    function parseCSV(texte) {
        const lignes = [];
        let ligne = [], champ = '', guillemets = false;
        for (let i = 0; i < texte.length; i++) {
            const c = texte[i];
            if (guillemets) {
                if (c === '"' && texte[i + 1] === '"') { champ += '"'; i++; }
                else if (c === '"') { guillemets = false; }
                else { champ += c; }
            } else if (c === '"') { guillemets = true; }
            else if (c === ',') { ligne.push(champ); champ = ''; }
            else if (c === '\n' || c === '\r') {
                if (c === '\r' && texte[i + 1] === '\n') i++;
                ligne.push(champ); lignes.push(ligne); ligne = []; champ = '';
            } else { champ += c; }
        }
        if (champ !== '' || ligne.length) { ligne.push(champ); lignes.push(ligne); }
        const entetes = (lignes.shift() || []).map(cle);
        const donnees = lignes
            .map(l => { const o = {}; entetes.forEach((h, i) => { if (h) o[h] = (l[i] || '').trim(); }); return o; })
            .filter(o => Object.values(o).some(v => v !== ''));
        return { entetes, lignes: donnees };
    }

    function esc(t) {
        return String(t || '').replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function estVisible(ligne) {
        const v = cle(ligne['afficher'] || 'oui');
        return !['non', 'n', 'no', 'false', 'faux', '0'].includes(v);
    }

    /* "12" -> "12 €", "12,5" -> "12,50 €", "5-7" -> "5-7 €", "12 €" reste tel quel */
    function prixAffiche(p) {
        p = String(p || '').trim();
        if (!p) return '';
        if (/€/.test(p)) return p;
        if (/^\d+([.,]\d+)?$/.test(p)) {
            const n = parseFloat(p.replace(',', '.'));
            p = Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',');
        }
        return p + ' €';
    }

    async function chargerOnglet(nom) {
        const ctrl = new AbortController();
        const minuteur = setTimeout(() => ctrl.abort(), 6000);
        try {
            const rep = await fetch(sheetUrl(nom), { signal: ctrl.signal });
            if (!rep.ok) throw new Error('HTTP ' + rep.status);
            return parseCSV(await rep.text());
        } finally {
            clearTimeout(minuteur);
        }
    }

    /* Essaie chaque nom possible de l'onglet et ne garde que celui dont les
       colonnes sont reconnues. (Si un nom n'existe pas, Google renvoie le
       PREMIER onglet du fichier : ce contrôle évite d'afficher le mauvais contenu.) */
    async function chargerOngletValide(noms, colonnes) {
        let raison = 'onglet introuvable';
        for (const nom of noms) {
            try {
                const { entetes, lignes } = await chargerOnglet(nom);
                if (colonnes.every(c => entetes.includes(c))) {
                    return { lignes: lignes.filter(estVisible), nom };
                }
                raison = 'colonne « ' + colonnes.join(', ') + ' » absente';
            } catch (err) {
                raison = err.name === 'AbortError' ? 'Google Sheet trop lent (6 s)' : 'Google Sheet inaccessible (partage ?)';
            }
        }
        return { lignes: null, raison };
    }

    function afficherMenu(zone, lignes) {
        const plats = lignes.filter(l => l['plat']);
        if (!plats.length) return false;
        const categories = [];
        const parCat = {};
        let catPrec = '';
        plats.forEach(l => {
            const cat = l['categorie'] || catPrec || 'Autres';
            catPrec = cat;
            if (!parCat[cat]) { parCat[cat] = []; categories.push(cat); }
            parCat[cat].push(l);
        });
        zone.innerHTML = categories.map(cat => `
            <section class="menu-category">
                <h3>${esc(cat)}</h3>
                ${parCat[cat].map(p => `
                <div class="menu-item">
                    <div class="menu-item-header">
                        <span class="menu-item-name">${esc(p['plat'])}</span>
                        <span class="menu-leader" aria-hidden="true"></span>
                        <span class="menu-item-price">${esc(prixAffiche(p['prix']))}</span>
                    </div>
                    ${p['description'] ? `<p class="menu-item-desc">${esc(p['description'])}</p>` : ''}
                </div>`).join('')}
            </section>`).join('');
        return true;
    }

    function srcPhoto(p) {
        p = (p || '').trim();
        if (!p) return '';
        if (/^https?:\/\//i.test(p)) {
            /* Lien de partage Google Drive -> lien d'image directe */
            const m = p.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/);
            return m ? 'https://lh3.googleusercontent.com/d/' + m[1] : p;
        }
        return 'photos/' + p;
    }

    function afficherEvenements(zone, lignes) {
        const events = lignes.filter(e => e['titre']);
        if (!events.length) return false;
        zone.innerHTML = events.map(e => `
            <li class="event-card">
                <div class="event-image">
                    ${e['photo'] ? `<img src="${esc(srcPhoto(e['photo']))}" alt="" loading="lazy" decoding="async" width="960" height="720">` : ''}
                </div>
                <div class="event-info">
                    <h3 class="event-title">${esc(e['titre'])}</h3>
                    ${e['quand'] ? `<p class="event-date">${esc(e['quand'])}</p>` : ''}
                    <p class="event-desc">${esc(e['description'])}</p>
                </div>
            </li>`).join('');
        surveillerPhotos(zone);
        return true;
    }

    function afficherHoraires(zone, lignes) {
        const jours = lignes.filter(h => h['jour']);
        if (!jours.length) return false;
        zone.innerHTML = jours.map(h =>
            `<li><span class="day">${esc(h['jour'])}</span> <span>${esc(h['horaires'])}</span></li>`
        ).join('');
        return true;
    }

    /* ---------- Avis : classés du plus récent au plus ancien ---------- */
    const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
                  'août', 'septembre', 'octobre', 'novembre', 'décembre'];

    function lireDate(t) {
        t = String(t || '').trim();
        let m;
        if ((m = t.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/))) {
            const an = +m[3] < 100 ? 2000 + +m[3] : +m[3];
            return new Date(an, +m[2] - 1, +m[1]);
        }
        if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return new Date(+m[1], +m[2] - 1, +m[3]);
        if ((m = t.match(/^Date\((\d+),(\d+),(\d+)/))) return new Date(+m[1], +m[2], +m[3]);
        return null;
    }

    function noteSur5(note) {
        const n = Math.round(parseFloat(String(note || '').replace(',', '.')));
        return n >= 1 && n <= 5 ? n : 0;
    }

    function afficherAvis(zone, lignes) {
        const avis = lignes
            .filter(a => a['avis'])
            .map((a, i) => ({ a, d: lireDate(a['date']), i }))
            .sort((x, y) => ((y.d ? y.d.getTime() : -Infinity) - (x.d ? x.d.getTime() : -Infinity)) || (x.i - y.i));
        if (!avis.length) return false;
        zone.innerHTML = avis.map(({ a, d }) => {
            const n = noteSur5(a['note']);
            const texte = a['avis'].replace(/^[\s"«“]+|[\s"»”]+$/g, '');
            const quand = d ? MOIS[d.getMonth()] + ' ' + d.getFullYear() : a['date'];
            return `
            <li class="review-card card">
                <div class="review-header">
                    <div>
                        <p class="review-author">${esc(a['nom'] || 'Client')}</p>
                        ${quand ? `<p class="review-date">${esc(quand)}</p>` : ''}
                    </div>
                    ${n ? `<p class="stars" role="img" aria-label="Note : ${n} sur 5">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</p>` : ''}
                </div>
                <blockquote class="review-text">« ${esc(texte)} »</blockquote>
                <span class="review-platform">${esc(a['source'] || 'Google')}</span>
            </li>`;
        }).join('');
        return true;
    }

    const ONGLETS = [
        { zone: 'menu-dynamique',     noms: ['Carte', 'Menu'],                          colonnes: ['plat'],  afficher: afficherMenu },
        { zone: 'events-dynamique',   noms: ['Événements', 'Evenements', 'Evénements'], colonnes: ['titre'], afficher: afficherEvenements },
        { zone: 'horaires-dynamique', noms: ['Horaires'],                               colonnes: ['jour'],  afficher: afficherHoraires },
        { zone: 'avis-dynamique',     noms: ['Avis'],                                   colonnes: ['avis'],  afficher: afficherAvis }
    ];

    async function chargerContenuRestaurateur() {
        const lienAvis = document.getElementById('lien-laisser-avis');
        if (lienAvis && LIEN_LAISSER_AVIS_GOOGLE) {
            lienAvis.href = LIEN_LAISSER_AVIS_GOOGLE;
            lienAvis.hidden = false;
        }
        const aCharger = ONGLETS.filter(o => document.getElementById(o.zone));
        if (!GOOGLE_SHEET_ID || !aCharger.length) return;
        await Promise.all(aCharger.map(async o => {
            const zone = document.getElementById(o.zone);
            zone.setAttribute('aria-busy', 'true');
            const { lignes, nom, raison } = await chargerOngletValide(o.noms, o.colonnes);
            const ok = lignes ? o.afficher(zone, lignes) : false;
            zone.removeAttribute('aria-busy');
            etatsVerif.push({ onglet: o.noms[0], ok, detail: ok ? 'onglet « ' + nom + ' » lu (' + lignes.length + ' lignes)' : (lignes ? 'onglet vide' : raison) });
            if (!ok) console.warn('[Google Sheet] Onglet « ' + o.noms[0] + ' » : ' + (raison || 'vide') + '. Contenu par défaut conservé.');
        }));
        afficherVerif();
    }

    /* Encadré de vérification, visible seulement avec « ?verif » dans l'adresse */
    function afficherVerif() {
        if (!new URLSearchParams(location.search).has('verif') || !etatsVerif.length) return;
        const box = document.createElement('div');
        box.setAttribute('role', 'status');
        box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:400;max-width:460px;margin:0 auto;' +
            'padding:16px 18px;background:#111;color:#f1e6cf;border:1px solid #d4a956;font:14px/1.5 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.4)';
        box.innerHTML = '<strong style="color:#e8c97d">Vérification du Google Sheet</strong><br>' +
            etatsVerif.map(e => (e.ok ? '✅ ' : '⚠️ ') + esc(e.onglet) + ' : ' + esc(e.detail)).join('<br>');
        document.body.appendChild(box);
    }

    chargerContenuRestaurateur();

    /* =====================================================================
       FORMULAIRES (réservation et contact) envoyés par email via Web3Forms
       ===================================================================== */
    function afficherMsg(zone, ok, html) {
        zone.innerHTML = '<div class="form-msg ' + (ok ? 'form-msg--ok' : 'form-msg--error') + '">' + html + '</div>';
        zone.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const appelezNous = 'appelez-nous au <a href="' + TELEPHONE_LIEN + '">' + TELEPHONE + '</a>';

    async function envoyerFormulaire(form, donnees, messageOk) {
        const zoneMsg = form.querySelector('.form-status');
        const bouton = form.querySelector('button[type="submit"]');
        const texteBouton = bouton.textContent;

        if (form.botcheck && form.botcheck.checked) return; // robot détecté

        if (!WEB3FORMS_ACCESS_KEY) {
            afficherMsg(zoneMsg, false, 'L’envoi en ligne n’est pas encore activé. Merci de nous appeler au <a href="' + TELEPHONE_LIEN + '">' + TELEPHONE + '</a>.');
            return;
        }
        if (navigator.onLine === false) {
            afficherMsg(zoneMsg, false, 'Vous semblez hors connexion. Vérifiez votre réseau puis réessayez, ou ' + appelezNous + '.');
            return;
        }

        bouton.disabled = true;
        bouton.textContent = 'Envoi en cours…';
        const ctrl = new AbortController();
        const minuteur = setTimeout(() => ctrl.abort(), 15000);
        try {
            const rep = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(Object.assign({
                    access_key: WEB3FORMS_ACCESS_KEY,
                    from_name: 'Site de l’AK vigie'
                }, donnees)),
                signal: ctrl.signal
            });
            const resultat = await rep.json();
            if (!resultat.success) throw new Error(resultat.message || 'Erreur');
            afficherMsg(zoneMsg, true, messageOk);
            form.reset();
        } catch (err) {
            console.error('[Formulaire]', err);
            const lent = err.name === 'AbortError';
            afficherMsg(zoneMsg, false, (lent ? 'L’envoi prend trop de temps.' : 'Oups, l’envoi n’a pas fonctionné.') +
                ' Réessayez dans un instant ou ' + appelezNous + '.');
        } finally {
            clearTimeout(minuteur);
            bouton.disabled = false;
            bouton.textContent = texteBouton;
        }
    }

    const formResa = document.getElementById('form-reservation');
    if (formResa) {
        // Pas de réservation dans le passé
        const champDate = formResa.querySelector('input[name="date"]');
        if (champDate) {
            const d = new Date();
            champDate.min = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
        }
        formResa.addEventListener('submit', e => {
            e.preventDefault();
            const d = Object.fromEntries(new FormData(formResa));
            const dateFr = d.date ? d.date.split('-').reverse().join('/') : '';
            const pers = d.personnes === '1' ? '1 personne' : d.personnes + ' personnes';
            const donnees = {
                subject: 'Nouvelle réservation : ' + d.nom + ' – ' + dateFr + ' à ' + d.heure + ' – ' + pers,
                replyto: d.email,
                'Type': 'Demande de réservation',
                'Nom': d.nom,
                'Téléphone': d.telephone,
                'Email': d.email,
                'Date': dateFr,
                'Heure': d.heure,
                'Nombre de personnes': pers
            };
            if (d.remarque) donnees['Remarque'] = d.remarque;
            envoyerFormulaire(formResa, donnees,
                '✓ Demande envoyée, merci ! Nous vous confirmons votre table par téléphone ou par email.');
        });
    }

    const formContact = document.getElementById('form-contact');
    if (formContact) {
        formContact.addEventListener('submit', e => {
            e.preventDefault();
            const d = Object.fromEntries(new FormData(formContact));
            envoyerFormulaire(formContact, {
                subject: 'Nouveau message de ' + d.nom + ' (site l’AK vigie)',
                replyto: d.email,
                'Type': 'Message du formulaire de contact',
                'Nom': d.nom,
                'Email': d.email,
                'Message': d.message
            }, '✓ Message envoyé, merci ! Nous vous répondons très vite.');
        });
    }
})();
