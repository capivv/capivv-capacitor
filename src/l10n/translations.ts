/**
 * Capivv SDK Localization
 *
 * Provides localized strings for the Capivv SDK UI components.
 */

export type SupportedLocale = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh' | 'pt' | 'it';

export interface CapivvStrings {
  // Common
  'common.continue': string;
  'common.cancel': string;
  'common.close': string;
  'common.done': string;
  'common.loading': string;
  'common.processing': string;
  'common.error': string;
  'common.success': string;
  'common.tryAgain': string;

  // Paywall
  'paywall.restore': string;
  'paywall.restoring': string;
  'paywall.purchasing': string;
  'paywall.startTrial': string;
  'paywall.then': string;
  'paywall.perMonth': string;
  'paywall.perYear': string;
  'paywall.perWeek': string;
  'paywall.bestValue': string;
  'paywall.mostPopular': string;
  'paywall.save': string;
  'paywall.freeTrialIncluded': string;
  'paywall.termsAndPrivacy': string;
  'paywall.legalDisclaimer': string;
  'paywall.unlockPremium': string;
  'paywall.noProductsAvailable': string;

  // Errors
  'error.unableToLoad': string;
  'error.purchaseFailed': string;
  'error.restoreFailed': string;
  'error.networkError': string;
  'error.somethingWentWrong': string;
  'error.dismiss': string;
  'error.failedToLoadOfferings': string;

  // FAQ
  'faq.title': string;

  // Social Proof
  'socialProof.rating': string;
  'socialProof.reviews': string;
  'socialProof.downloads': string;

  // Countdown
  'countdown.days': string;
  'countdown.hours': string;
  'countdown.minutes': string;
  'countdown.seconds': string;
}

const translations: Record<SupportedLocale, CapivvStrings> = {
  en: {
    'common.continue': 'Continue',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.done': 'Done',
    'common.loading': 'Loading...',
    'common.processing': 'Processing...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.tryAgain': 'Try Again',
    'paywall.restore': 'Restore Purchases',
    'paywall.restoring': 'Restoring...',
    'paywall.purchasing': 'Purchasing...',
    'paywall.startTrial': 'Start %d-day free trial',
    'paywall.then': 'Then %@',
    'paywall.perMonth': '/month',
    'paywall.perYear': '/year',
    'paywall.perWeek': '/week',
    'paywall.bestValue': 'Best Value',
    'paywall.mostPopular': 'Most Popular',
    'paywall.save': 'Save %d%%',
    'paywall.freeTrialIncluded': 'Free trial included',
    'paywall.termsAndPrivacy': 'Terms of Service & Privacy Policy',
    'paywall.legalDisclaimer':
      'Payment will be charged to your account at confirmation of purchase. Subscription automatically renews unless it is canceled at least 24 hours before the end of the current period.',
    'paywall.unlockPremium': 'Unlock Premium',
    'paywall.noProductsAvailable': 'No products available',
    'error.unableToLoad': 'Unable to Load',
    'error.purchaseFailed': 'Purchase Failed',
    'error.restoreFailed': 'Restore Failed',
    'error.networkError': 'Network Error',
    'error.somethingWentWrong': 'Something went wrong',
    'error.dismiss': 'Dismiss',
    'error.failedToLoadOfferings': 'Failed to load offerings',
    'faq.title': 'Frequently Asked Questions',
    'socialProof.rating': 'Rating',
    'socialProof.reviews': 'reviews',
    'socialProof.downloads': 'downloads',
    'countdown.days': 'd',
    'countdown.hours': 'h',
    'countdown.minutes': 'm',
    'countdown.seconds': 's',
  },
  es: {
    'common.continue': 'Continuar',
    'common.cancel': 'Cancelar',
    'common.close': 'Cerrar',
    'common.done': 'Hecho',
    'common.loading': 'Cargando...',
    'common.processing': 'Procesando...',
    'common.error': 'Error',
    'common.success': 'Exito',
    'common.tryAgain': 'Intentar de nuevo',
    'paywall.restore': 'Restaurar compras',
    'paywall.restoring': 'Restaurando...',
    'paywall.purchasing': 'Comprando...',
    'paywall.startTrial': 'Comenzar prueba de %d dias',
    'paywall.then': 'Luego %@',
    'paywall.perMonth': '/mes',
    'paywall.perYear': '/ano',
    'paywall.perWeek': '/semana',
    'paywall.bestValue': 'Mejor valor',
    'paywall.mostPopular': 'Mas popular',
    'paywall.save': 'Ahorra %d%%',
    'paywall.freeTrialIncluded': 'Prueba gratuita incluida',
    'paywall.termsAndPrivacy': 'Terminos de servicio y politica de privacidad',
    'paywall.legalDisclaimer':
      'El pago se cargara a su cuenta en la confirmacion de la compra. La suscripcion se renueva automaticamente a menos que se cancele al menos 24 horas antes del final del periodo actual.',
    'paywall.unlockPremium': 'Desbloquear Premium',
    'paywall.noProductsAvailable': 'No hay productos disponibles',
    'error.unableToLoad': 'No se puede cargar',
    'error.purchaseFailed': 'Compra fallida',
    'error.restoreFailed': 'Restauracion fallida',
    'error.networkError': 'Error de red',
    'error.somethingWentWrong': 'Algo salio mal',
    'error.dismiss': 'Descartar',
    'error.failedToLoadOfferings': 'Error al cargar ofertas',
    'faq.title': 'Preguntas frecuentes',
    'socialProof.rating': 'Calificacion',
    'socialProof.reviews': 'resenas',
    'socialProof.downloads': 'descargas',
    'countdown.days': 'd',
    'countdown.hours': 'h',
    'countdown.minutes': 'm',
    'countdown.seconds': 's',
  },
  fr: {
    'common.continue': 'Continuer',
    'common.cancel': 'Annuler',
    'common.close': 'Fermer',
    'common.done': 'Termine',
    'common.loading': 'Chargement...',
    'common.processing': 'Traitement...',
    'common.error': 'Erreur',
    'common.success': 'Succes',
    'common.tryAgain': 'Reessayer',
    'paywall.restore': 'Restaurer les achats',
    'paywall.restoring': 'Restauration...',
    'paywall.purchasing': 'Achat...',
    'paywall.startTrial': "Commencer l'essai de %d jours",
    'paywall.then': 'Puis %@',
    'paywall.perMonth': '/mois',
    'paywall.perYear': '/an',
    'paywall.perWeek': '/semaine',
    'paywall.bestValue': 'Meilleur rapport qualite-prix',
    'paywall.mostPopular': 'Le plus populaire',
    'paywall.save': 'Economisez %d%%',
    'paywall.freeTrialIncluded': 'Essai gratuit inclus',
    'paywall.termsAndPrivacy': "Conditions d'utilisation et politique de confidentialite",
    'paywall.legalDisclaimer':
      "Le paiement sera debite de votre compte lors de la confirmation de l'achat. L'abonnement se renouvelle automatiquement sauf annulation au moins 24 heures avant la fin de la periode en cours.",
    'paywall.unlockPremium': 'Debloquer Premium',
    'paywall.noProductsAvailable': 'Aucun produit disponible',
    'error.unableToLoad': 'Impossible de charger',
    'error.purchaseFailed': "Echec de l'achat",
    'error.restoreFailed': 'Echec de la restauration',
    'error.networkError': 'Erreur reseau',
    'error.somethingWentWrong': "Une erreur s'est produite",
    'error.dismiss': 'Fermer',
    'error.failedToLoadOfferings': 'Echec du chargement des offres',
    'faq.title': 'Questions frequentes',
    'socialProof.rating': 'Note',
    'socialProof.reviews': 'avis',
    'socialProof.downloads': 'telechargements',
    'countdown.days': 'j',
    'countdown.hours': 'h',
    'countdown.minutes': 'm',
    'countdown.seconds': 's',
  },
  de: {
    'common.continue': 'Fortfahren',
    'common.cancel': 'Abbrechen',
    'common.close': 'Schliessen',
    'common.done': 'Fertig',
    'common.loading': 'Laden...',
    'common.processing': 'Verarbeitung...',
    'common.error': 'Fehler',
    'common.success': 'Erfolg',
    'common.tryAgain': 'Erneut versuchen',
    'paywall.restore': 'Kaufe wiederherstellen',
    'paywall.restoring': 'Wiederherstellen...',
    'paywall.purchasing': 'Kaufen...',
    'paywall.startTrial': '%d-tagige Testversion starten',
    'paywall.then': 'Dann %@',
    'paywall.perMonth': '/Monat',
    'paywall.perYear': '/Jahr',
    'paywall.perWeek': '/Woche',
    'paywall.bestValue': 'Bester Wert',
    'paywall.mostPopular': 'Am beliebtesten',
    'paywall.save': '%d%% sparen',
    'paywall.freeTrialIncluded': 'Kostenlose Testversion enthalten',
    'paywall.termsAndPrivacy': 'Nutzungsbedingungen und Datenschutz',
    'paywall.legalDisclaimer':
      'Die Zahlung wird bei Kaufbestatigung von Ihrem Konto abgebucht. Das Abonnement verlangert sich automatisch, sofern es nicht mindestens 24 Stunden vor Ende des aktuellen Zeitraums gekundigt wird.',
    'paywall.unlockPremium': 'Premium freischalten',
    'paywall.noProductsAvailable': 'Keine Produkte verfugbar',
    'error.unableToLoad': 'Laden nicht moglich',
    'error.purchaseFailed': 'Kauf fehlgeschlagen',
    'error.restoreFailed': 'Wiederherstellung fehlgeschlagen',
    'error.networkError': 'Netzwerkfehler',
    'error.somethingWentWrong': 'Etwas ist schief gelaufen',
    'error.dismiss': 'Schliessen',
    'error.failedToLoadOfferings': 'Angebote konnten nicht geladen werden',
    'faq.title': 'Haufig gestellte Fragen',
    'socialProof.rating': 'Bewertung',
    'socialProof.reviews': 'Bewertungen',
    'socialProof.downloads': 'Downloads',
    'countdown.days': 'T',
    'countdown.hours': 'Std',
    'countdown.minutes': 'Min',
    'countdown.seconds': 'Sek',
  },
  ja: {
    'common.continue': '続ける',
    'common.cancel': 'キャンセル',
    'common.close': '閉じる',
    'common.done': '完了',
    'common.loading': '読み込み中...',
    'common.processing': '処理中...',
    'common.error': 'エラー',
    'common.success': '成功',
    'common.tryAgain': '再試行',
    'paywall.restore': '購入を復元',
    'paywall.restoring': '復元中...',
    'paywall.purchasing': '購入中...',
    'paywall.startTrial': '%d日間の無料トライアルを開始',
    'paywall.then': 'その後 %@',
    'paywall.perMonth': '/月',
    'paywall.perYear': '/年',
    'paywall.perWeek': '/週',
    'paywall.bestValue': 'ベストバリュー',
    'paywall.mostPopular': '最も人気',
    'paywall.save': '%d%%オフ',
    'paywall.freeTrialIncluded': '無料トライアル付き',
    'paywall.termsAndPrivacy': '利用規約とプライバシーポリシー',
    'paywall.legalDisclaimer':
      '購入確認時にアカウントに請求されます。現在の期間終了の24時間前までにキャンセルしない限り、サブスクリプションは自動更新されます。',
    'paywall.unlockPremium': 'プレミアムを解除',
    'paywall.noProductsAvailable': '利用可能な製品がありません',
    'error.unableToLoad': '読み込めません',
    'error.purchaseFailed': '購入に失敗しました',
    'error.restoreFailed': '復元に失敗しました',
    'error.networkError': 'ネットワークエラー',
    'error.somethingWentWrong': '問題が発生しました',
    'error.dismiss': '閉じる',
    'error.failedToLoadOfferings': 'オファーの読み込みに失敗しました',
    'faq.title': 'よくある質問',
    'socialProof.rating': '評価',
    'socialProof.reviews': 'レビュー',
    'socialProof.downloads': 'ダウンロード',
    'countdown.days': '日',
    'countdown.hours': '時',
    'countdown.minutes': '分',
    'countdown.seconds': '秒',
  },
  zh: {
    'common.continue': '继续',
    'common.cancel': '取消',
    'common.close': '关闭',
    'common.done': '完成',
    'common.loading': '加载中...',
    'common.processing': '处理中...',
    'common.error': '错误',
    'common.success': '成功',
    'common.tryAgain': '重试',
    'paywall.restore': '恢复购买',
    'paywall.restoring': '恢复中...',
    'paywall.purchasing': '购买中...',
    'paywall.startTrial': '开始%d天免费试用',
    'paywall.then': '然后 %@',
    'paywall.perMonth': '/月',
    'paywall.perYear': '/年',
    'paywall.perWeek': '/周',
    'paywall.bestValue': '最佳价值',
    'paywall.mostPopular': '最受欢迎',
    'paywall.save': '节省%d%%',
    'paywall.freeTrialIncluded': '含免费试用',
    'paywall.termsAndPrivacy': '服务条款和隐私政策',
    'paywall.legalDisclaimer':
      '确认购买后将从您的账户扣款。除非在当前周期结束前至少24小时取消，否则订阅将自动续订。',
    'paywall.unlockPremium': '解锁高级版',
    'paywall.noProductsAvailable': '没有可用的产品',
    'error.unableToLoad': '无法加载',
    'error.purchaseFailed': '购买失败',
    'error.restoreFailed': '恢复失败',
    'error.networkError': '网络错误',
    'error.somethingWentWrong': '出了点问题',
    'error.dismiss': '关闭',
    'error.failedToLoadOfferings': '加载产品失败',
    'faq.title': '常见问题',
    'socialProof.rating': '评分',
    'socialProof.reviews': '评论',
    'socialProof.downloads': '下载',
    'countdown.days': '天',
    'countdown.hours': '时',
    'countdown.minutes': '分',
    'countdown.seconds': '秒',
  },
  pt: {
    'common.continue': 'Continuar',
    'common.cancel': 'Cancelar',
    'common.close': 'Fechar',
    'common.done': 'Concluido',
    'common.loading': 'Carregando...',
    'common.processing': 'Processando...',
    'common.error': 'Erro',
    'common.success': 'Sucesso',
    'common.tryAgain': 'Tentar novamente',
    'paywall.restore': 'Restaurar compras',
    'paywall.restoring': 'Restaurando...',
    'paywall.purchasing': 'Comprando...',
    'paywall.startTrial': 'Iniciar teste de %d dias',
    'paywall.then': 'Depois %@',
    'paywall.perMonth': '/mes',
    'paywall.perYear': '/ano',
    'paywall.perWeek': '/semana',
    'paywall.bestValue': 'Melhor valor',
    'paywall.mostPopular': 'Mais popular',
    'paywall.save': 'Economize %d%%',
    'paywall.freeTrialIncluded': 'Teste gratuito incluso',
    'paywall.termsAndPrivacy': 'Termos de servico e politica de privacidade',
    'paywall.legalDisclaimer':
      'O pagamento sera cobrado em sua conta na confirmacao da compra. A assinatura e renovada automaticamente, a menos que seja cancelada pelo menos 24 horas antes do final do periodo atual.',
    'paywall.unlockPremium': 'Desbloquear Premium',
    'paywall.noProductsAvailable': 'Nenhum produto disponivel',
    'error.unableToLoad': 'Nao foi possivel carregar',
    'error.purchaseFailed': 'Falha na compra',
    'error.restoreFailed': 'Falha na restauracao',
    'error.networkError': 'Erro de rede',
    'error.somethingWentWrong': 'Algo deu errado',
    'error.dismiss': 'Fechar',
    'error.failedToLoadOfferings': 'Falha ao carregar ofertas',
    'faq.title': 'Perguntas frequentes',
    'socialProof.rating': 'Avaliacao',
    'socialProof.reviews': 'avaliacoes',
    'socialProof.downloads': 'downloads',
    'countdown.days': 'd',
    'countdown.hours': 'h',
    'countdown.minutes': 'm',
    'countdown.seconds': 's',
  },
  it: {
    'common.continue': 'Continua',
    'common.cancel': 'Annulla',
    'common.close': 'Chiudi',
    'common.done': 'Fatto',
    'common.loading': 'Caricamento...',
    'common.processing': 'Elaborazione...',
    'common.error': 'Errore',
    'common.success': 'Successo',
    'common.tryAgain': 'Riprova',
    'paywall.restore': 'Ripristina acquisti',
    'paywall.restoring': 'Ripristino...',
    'paywall.purchasing': 'Acquisto...',
    'paywall.startTrial': 'Inizia prova gratuita di %d giorni',
    'paywall.then': 'Poi %@',
    'paywall.perMonth': '/mese',
    'paywall.perYear': '/anno',
    'paywall.perWeek': '/settimana',
    'paywall.bestValue': 'Miglior valore',
    'paywall.mostPopular': 'Piu popolare',
    'paywall.save': 'Risparmia %d%%',
    'paywall.freeTrialIncluded': 'Prova gratuita inclusa',
    'paywall.termsAndPrivacy': 'Termini di servizio e privacy',
    'paywall.legalDisclaimer':
      "Il pagamento verra addebitato sul tuo account alla conferma dell'acquisto. L'abbonamento si rinnova automaticamente a meno che non venga annullato almeno 24 ore prima della fine del periodo corrente.",
    'paywall.unlockPremium': 'Sblocca Premium',
    'paywall.noProductsAvailable': 'Nessun prodotto disponibile',
    'error.unableToLoad': 'Impossibile caricare',
    'error.purchaseFailed': 'Acquisto fallito',
    'error.restoreFailed': 'Ripristino fallito',
    'error.networkError': 'Errore di rete',
    'error.somethingWentWrong': 'Qualcosa e andato storto',
    'error.dismiss': 'Chiudi',
    'error.failedToLoadOfferings': 'Impossibile caricare le offerte',
    'faq.title': 'Domande frequenti',
    'socialProof.rating': 'Valutazione',
    'socialProof.reviews': 'recensioni',
    'socialProof.downloads': 'download',
    'countdown.days': 'g',
    'countdown.hours': 'h',
    'countdown.minutes': 'm',
    'countdown.seconds': 's',
  },
};

/**
 * Get the current locale from navigator
 */
function getCurrentLocale(): SupportedLocale {
  if (typeof navigator !== 'undefined' && navigator.language) {
    const lang = navigator.language.split('-')[0] as SupportedLocale;
    if (lang in translations) {
      return lang;
    }
  }
  return 'en';
}

/**
 * Capivv L10n helper
 */
class CapivvL10n {
  private locale: SupportedLocale;

  constructor(locale?: SupportedLocale) {
    this.locale = locale || getCurrentLocale();
  }

  /**
   * Get a localized string by key
   */
  get(key: keyof CapivvStrings): string {
    return translations[this.locale][key] || translations.en[key] || key;
  }

  /**
   * Get a formatted string with placeholder replacement
   */
  format(key: keyof CapivvStrings, ...args: (string | number)[]): string {
    let str = this.get(key);
    args.forEach((arg, index) => {
      str = str.replace(`%${index === 0 ? 'd' : '@'}`, String(arg));
    });
    return str;
  }

  /**
   * Set the locale
   */
  setLocale(locale: SupportedLocale): void {
    this.locale = locale;
  }

  /**
   * Get the current locale
   */
  getLocale(): SupportedLocale {
    return this.locale;
  }
}

// Export singleton instance
export const l10n = new CapivvL10n();

// Export class for custom instances
export { CapivvL10n };
