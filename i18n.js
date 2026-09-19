/* Vantawebs i18n — UI strings for the metadata tool (en/ar/fr/es).
   Language is read from <html lang>. Falls back to English for missing keys. */
(function(){
'use strict';

var DICT = {
en: {
  processing: 'Processing...',
  unsupported: 'Unsupported file type',
  supported_list: 'Supported: JPG, PNG, WebP, HEIC, PDF, MP4, MOV',
  free_limit: 'Free tier: max {n} files per batch',
  free_hint: 'Drop fewer files, or unlock Pro for unlimited batches',
  processing_files: 'Processing {n} files...',
  processing_one: 'Processing {i}/{n}: {name}',
  show_meta: 'Show metadata found ({n} items)',
  hide_meta: 'Hide metadata found',
  no_meta: 'No metadata found',
  file_clean: 'No metadata found — file is clean',
  removed: 'REMOVED',
  clean: 'CLEAN',
  download: 'Download',
  creating_zip: 'Creating ZIP...',
  download_all: 'Download All (ZIP)',
  zip_failed: 'ZIP creation failed: {msg}',
  unlock_pro: 'Unlock Pro',
  pro_on: 'Pro ✓',
  activated_btn: 'Activated',
  pro_active_msg: 'Pro is active on this browser.',
  pro_ok_msg: 'Pro activated! Unlimited batches unlocked.',
  invalid_key: 'Invalid license key. Please check and try again.',
  meta_found_title: 'Metadata found in this file',
  clean_now: 'Clean it now',
  cat_device: 'Device Info',
  cat_location: 'Location',
  cat_dates: 'Date & Time',
  cat_software: 'Software',
  cat_author: 'Author & Rights',
  cat_ai: 'AI Provenance',
  cat_embedded: 'Embedded',
  cat_pdf: 'PDF Metadata'
},
ar: {
  processing: 'جارٍ المعالجة...',
  unsupported: 'نوع ملف غير مدعوم',
  supported_list: 'المدعوم: JPG، PNG، WebP، HEIC، PDF، MP4، MOV',
  free_limit: 'الخطة المجانية: {n} ملفات كحد أقصى لكل دفعة',
  free_hint: 'أفلت ملفات أقل، أو افتح Pro لدفعات غير محدودة',
  processing_files: 'جارٍ معالجة {n} ملفات...',
  processing_one: 'جارٍ معالجة {i}/{n}: {name}',
  show_meta: 'عرض البيانات الوصفية المكتشفة ({n})',
  hide_meta: 'إخفاء البيانات الوصفية',
  no_meta: 'لم يتم العثور على بيانات وصفية',
  file_clean: 'لم يتم العثور على بيانات وصفية — الملف نظيف',
  removed: 'تمت الإزالة',
  clean: 'نظيف',
  download: 'تحميل',
  creating_zip: 'جارٍ إنشاء ZIP...',
  download_all: 'تحميل الكل (ZIP)',
  zip_failed: 'فشل إنشاء ZIP: {msg}',
  unlock_pro: 'افتح Pro',
  pro_on: 'Pro ✓',
  activated_btn: 'مفعّل',
  pro_active_msg: 'Pro مفعّل على هذا المتصفح.',
  pro_ok_msg: 'تم تفعيل Pro! دفعات غير محدودة.',
  invalid_key: 'مفتاح ترخيص غير صالح. تحقق وحاول مجددًا.',
  meta_found_title: 'تم العثور على بيانات وصفية في هذا الملف',
  clean_now: 'نظّفه الآن',
  cat_device: 'معلومات الجهاز',
  cat_location: 'الموقع',
  cat_dates: 'التاريخ والوقت',
  cat_software: 'البرنامج',
  cat_author: 'المؤلف والحقوق',
  cat_ai: 'مصدر الذكاء الاصطناعي',
  cat_embedded: 'مضمّن',
  cat_pdf: 'بيانات PDF الوصفية'
},
fr: {
  processing: 'Traitement en cours...',
  unsupported: 'Type de fichier non pris en charge',
  supported_list: 'Pris en charge : JPG, PNG, WebP, HEIC, PDF, MP4, MOV',
  free_limit: 'Offre gratuite : {n} fichiers max par lot',
  free_hint: 'Déposez moins de fichiers, ou passez à Pro pour des lots illimités',
  processing_files: 'Traitement de {n} fichiers...',
  processing_one: 'Traitement de {i}/{n} : {name}',
  show_meta: 'Voir les métadonnées trouvées ({n})',
  hide_meta: 'Masquer les métadonnées',
  no_meta: 'Aucune métadonnée trouvée',
  file_clean: 'Aucune métadonnée trouvée — fichier propre',
  removed: 'SUPPRIMÉ',
  clean: 'PROPRE',
  download: 'Télécharger',
  creating_zip: 'Création du ZIP...',
  download_all: 'Tout télécharger (ZIP)',
  zip_failed: 'Échec de la création du ZIP : {msg}',
  unlock_pro: 'Passer à Pro',
  pro_on: 'Pro ✓',
  activated_btn: 'Activé',
  pro_active_msg: 'Pro est actif sur ce navigateur.',
  pro_ok_msg: 'Pro activé ! Lots illimités débloqués.',
  invalid_key: 'Clé de licence invalide. Vérifiez et réessayez.',
  meta_found_title: 'Métadonnées trouvées dans ce fichier',
  clean_now: 'Nettoyer maintenant',
  cat_device: 'Infos appareil',
  cat_location: 'Localisation',
  cat_dates: 'Date et heure',
  cat_software: 'Logiciel',
  cat_author: 'Auteur et droits',
  cat_ai: 'Provenance IA',
  cat_embedded: 'Intégré',
  cat_pdf: 'Métadonnées PDF'
},
es: {
  processing: 'Procesando...',
  unsupported: 'Tipo de archivo no compatible',
  supported_list: 'Compatibles: JPG, PNG, WebP, HEIC, PDF, MP4, MOV',
  free_limit: 'Plan gratis: {n} archivos máx. por lote',
  free_hint: 'Suelta menos archivos o pasa a Pro para lotes ilimitados',
  processing_files: 'Procesando {n} archivos...',
  processing_one: 'Procesando {i}/{n}: {name}',
  show_meta: 'Ver metadatos encontrados ({n})',
  hide_meta: 'Ocultar metadatos',
  no_meta: 'No se encontraron metadatos',
  file_clean: 'No se encontraron metadatos — archivo limpio',
  removed: 'ELIMINADO',
  clean: 'LIMPIO',
  download: 'Descargar',
  creating_zip: 'Creando ZIP...',
  download_all: 'Descargar todo (ZIP)',
  zip_failed: 'Error al crear el ZIP: {msg}',
  unlock_pro: 'Pasar a Pro',
  pro_on: 'Pro ✓',
  activated_btn: 'Activado',
  pro_active_msg: 'Pro está activo en este navegador.',
  pro_ok_msg: '¡Pro activado! Lotes ilimitados desbloqueados.',
  invalid_key: 'Clave de licencia no válida. Revisa e inténtalo de nuevo.',
  meta_found_title: 'Metadatos encontrados en este archivo',
  clean_now: 'Limpiar ahora',
  cat_device: 'Info del dispositivo',
  cat_location: 'Ubicación',
  cat_dates: 'Fecha y hora',
  cat_software: 'Software',
  cat_author: 'Autor y derechos',
  cat_ai: 'Procedencia de IA',
  cat_embedded: 'Integrado',
  cat_pdf: 'Metadatos del PDF'
}
};

var lang = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
if (!DICT[lang]) lang = 'en';

window.VTx = {
  lang: lang,
  t: function(key, vars) {
    var s = (DICT[lang] && DICT[lang][key]) || DICT.en[key] || key;
    if (vars) {
      for (var k in vars) {
        if (Object.prototype.hasOwnProperty.call(vars, k)) {
          s = s.split('{' + k + '}').join(String(vars[k]));
        }
      }
    }
    return s;
  }
};

window.t = function(key, vars) { return window.VTx.t(key, vars); };
})();
