// =============================================================================
// Årsredovisning Plugin — Action: "Generera årsredovisning"
// Klistra in detta i: Plugin Editor → Actions → [din action] → Action Code
//
// INDATA — definiera dessa som "Fields" i plugin-editorn:
//
//   Fältnamn (i Bubble)            Typ       Beskrivning
//   -------------------------------------------------------
//   sie_file_url                   text      URL till uppladdad SIE-fil
//
//   fb_verksamhet                  text      Allmänt om verksamheten
//   fb_sate                        text      Bolagets säte (t.ex. "Stockholm")
//   fb_handelser                   text      Väsentliga händelser under räkenskapsåret
//   fb_handelser_efter             text      Väsentliga händelser efter räkenskapsårets slut
//   fb_framtid                     text      Framtida utveckling
//   fb_forskning                   text      Forskning och utveckling
//   fb_filialer                    yes/no    Bolaget har filialer utomlands
//   fb_hallbarhet                  text      Hållbarhetsupplysningar
//   historiska_nyckeltal_json      text      JSON – se input.example.json
//
//   utdelning                      number    Föreslagen utdelning (kr), 0 = ingen
//   reservfond                     number    Avsättning till reservfond (kr)
//
//   har_anstallda                  yes/no
//   medelantal                     number    Medelantal anställda innevarande år
//   medelantal_fg                  number    Medelantal anställda föregående år
//   antal_kvinnor                  number    Varav kvinnor
//   loner_styrelse                 number    Löner styrelse/VD (kr)
//   loner_ovriga                   number    Löner övriga anställda (kr)
//   sociala_styrelse               number    Sociala kostnader styrelse/VD (kr)
//   sociala_ovriga                 number    Sociala kostnader övriga (kr)
//   pension_styrelse               number    Pensionskostnader styrelse/VD (kr)
//   pension_ovriga                 number    Pensionskostnader övriga (kr)
//
//   har_revisor                    yes/no
//   revisionsarvode                number    Arvode för revisionsuppdraget (kr)
//   ovriga_revisionsarvoden        number
//   skatteradgivning               number
//   ovriga_tjanster                number
//
//   immateriella_json              text      JSON-array – se input.example.json
//   materiella_json                text      JSON-array – se input.example.json
//   finansiella_json               text      JSON-array – se input.example.json
//
//   stallda_sakerheter             number    Ställda säkerheter (kr)
//   stallda_sakerheter_text        text      Beskrivning
//   eventualforpliktelser          number    Ansvarsförbindelser (kr)
//   eventualforpliktelser_text     text      Beskrivning
//
//   underskrivare_json             text      JSON: [{"name":"...","role":"..."},...]
//   underskrift_ort                text      Ort (t.ex. "Stockholm")
//   underskrift_datum              text      Datum YYYY-MM-DD
//
//   revisor_namn                   text
//   revisor_typ                    text      t.ex. "Auktoriserad revisor"
//   revisor_firma                  text
//   revisionsberattelse_datum      text      Datum YYYY-MM-DD
//
//   bolagsstamma_datum             text      Datum YYYY-MM-DD
//   utdelning_per_aktie            number
//
//   intyg_stammodatum              text      Datum YYYY-MM-DD
//   intyg_disposition_text         text      Stämmans beslut om disposition
//   intyg_undertecknarnamn         text
//   intyg_undertecknarroll         text
//   intyg_datum                    text      Datum YYYY-MM-DD
//
// UTDATA — definiera dessa som "Return values" i plugin-editorn:
//   pdf_base64              text      PDF-filen som base64-sträng
//   ixbrl                   text      iXBRL XHTML (inlämning till Bolagsverket)
//   har_fel                 yes/no    true om det finns ERROR-nivå valideringsfel
//   valideringsmeddelanden  text      Alla valideringsmeddelanden, en per rad
// =============================================================================

var p = properties;

// Hjälpfunktioner
function str(v) { return v && v.trim() ? v.trim() : undefined; }
function num(v) { return v && v !== 0 ? v : undefined; }
function json(v) {
  if (!v || !v.trim()) return undefined;
  try { return JSON.parse(v); } catch (e) {
    console.warn('Årsredovisning plugin — ogiltigt JSON:', v);
    return undefined;
  }
}

// -----------------------------------------------------------------------
// 1. Hämta SIE-filen och konvertera till base64
// -----------------------------------------------------------------------
if (!p.sie_file_url) {
  throw new Error('sie_file_url saknas — koppla Bubble file uploader till detta fält.');
}

return fetch(p.sie_file_url)
  .then(function (resp) {
    if (!resp.ok) throw new Error('Kunde inte hämta SIE-filen: HTTP ' + resp.status);
    return resp.arrayBuffer();
  })
  .then(function (buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    var sieBase64 = btoa(binary);

    // -----------------------------------------------------------------------
    // 2. Bygg AnnualReportInput från Bubble-fälten
    // -----------------------------------------------------------------------

    var hasFB = str(p.fb_verksamhet) || str(p.fb_sate) || str(p.fb_handelser) ||
                str(p.fb_handelser_efter) || str(p.fb_framtid) || str(p.fb_forskning) ||
                p.fb_filialer || str(p.fb_hallbarhet) || str(p.historiska_nyckeltal_json);

    var managementReport = hasFB ? {
      businessDescription:        str(p.fb_verksamhet),
      registeredOffice:           str(p.fb_sate),
      significantEvents:          str(p.fb_handelser),
      significantEventsAfterYear: str(p.fb_handelser_efter),
      futureOutlook:              str(p.fb_framtid),
      researchAndDevelopment:     str(p.fb_forskning),
      hasForeignBranches:         p.fb_filialer || undefined,
      sustainabilityInfo:         str(p.fb_hallbarhet),
      historicalKeyFigures:       json(p.historiska_nyckeltal_json),
    } : undefined;

    var disposition = (p.utdelning > 0 || p.reservfond > 0) ? {
      dividend:    p.utdelning  || 0,
      reserveFund: p.reservfond || 0,
    } : undefined;

    var employees = p.har_anstallda ? {
      hasEmployees:             true,
      averageEmployees:         p.medelantal    || 0,
      averageEmployeesPrevious: num(p.medelantal_fg),
      womenCount:               num(p.antal_kvinnor),
      salaries: (p.loner_styrelse || p.loner_ovriga) ? {
        board: p.loner_styrelse || 0,
        other: p.loner_ovriga   || 0,
      } : undefined,
      socialCosts: (p.sociala_styrelse || p.sociala_ovriga) ? {
        board: p.sociala_styrelse || 0,
        other: p.sociala_ovriga   || 0,
      } : undefined,
      pensionCosts: (p.pension_styrelse || p.pension_ovriga) ? {
        board: p.pension_styrelse || 0,
        other: p.pension_ovriga   || 0,
      } : undefined,
    } : undefined;

    var auditorFees = p.har_revisor ? {
      hasAuditor:       true,
      auditFee:         p.revisionsarvode        || 0,
      otherAuditFee:    p.ovriga_revisionsarvoden || 0,
      skatteradgivning: p.skatteradgivning        || 0,
      otherServices:    p.ovriga_tjanster         || 0,
    } : undefined;

    var pledges = (p.stallda_sakerheter > 0 || p.eventualforpliktelser > 0) ? {
      pledgesAmount:         p.stallda_sakerheter         || 0,
      pledgesDescription:    str(p.stallda_sakerheter_text),
      contingentLiabilities: p.eventualforpliktelser       || 0,
      contingentDescription: str(p.eventualforpliktelser_text),
    } : undefined;

    var notes = (employees || auditorFees ||
                 json(p.immateriella_json) || json(p.materiella_json) ||
                 json(p.finansiella_json)  || pledges) ? {
      employees:        employees,
      auditorFees:      auditorFees,
      intangibleAssets: json(p.immateriella_json),
      tangibleAssets:   json(p.materiella_json),
      financialAssets:  json(p.finansiella_json),
      pledges:          pledges,
    } : undefined;

    var auditor = (p.har_revisor && str(p.revisor_namn)) ? {
      name:       str(p.revisor_namn),
      type:       str(p.revisor_typ) || 'Auktoriserad revisor',
      firm:       str(p.revisor_firma),
      reportDate: str(p.revisionsberattelse_datum),
    } : undefined;

    var generalMeeting = str(p.bolagsstamma_datum) ? {
      date:             str(p.bolagsstamma_datum),
      dividendDecision: (p.utdelning || 0) > 0,
      dividendPerShare: num(p.utdelning_per_aktie),
      dividendTotal:    num(p.utdelning),
    } : undefined;

    var certification = str(p.intyg_stammodatum) ? {
      meetingDate:       str(p.intyg_stammodatum),
      dispositionText:   str(p.intyg_disposition_text) || '',
      signatoryName:     str(p.intyg_undertecknarnamn) || '',
      signatoryRole:     str(p.intyg_undertecknarroll) || '',
      certificationDate: str(p.intyg_datum) || '',
    } : undefined;

    var input = {
      managementReport: managementReport,
      disposition:      disposition,
      notes:            notes,
      signatories:      json(p.underskrivare_json),
      auditor:          auditor,
      signingCity:      str(p.underskrift_ort),
      signingDate:      str(p.underskrift_datum),
      generalMeeting:   generalMeeting,
      certification:    certification,
    };

    // -----------------------------------------------------------------------
    // 3. Generera rapporten
    // -----------------------------------------------------------------------
    return window.ArsredovisningPlugin.generateReportFromBase64(sieBase64, input);
  })
  .then(function (result) {
    // -----------------------------------------------------------------------
    // 4. Returnera till Bubble-workflow
    // -----------------------------------------------------------------------
    var harFel = result.validation.some(function (v) { return v.severity === 'error'; });
    var meddelanden = result.validation
      .map(function (v) { return '[' + v.severity.toUpperCase() + '] ' + v.code + ': ' + v.message; })
      .join('\n');

    return {
      pdf_base64:             result.pdfBase64,
      ixbrl:                  result.ixbrl,
      har_fel:                harFel,
      valideringsmeddelanden: meddelanden,
    };
  });
