import { openModal } from "../modules/core.js";

export function openAboutModal() {
  openModal(`
    <div style="text-align:center;">
      <div class="brand-glyph" style="width:52px;height:52px;margin:0 auto 14px;font-size:18px;">GR</div>
      <h2 style="margin-bottom:4px;">إبراهيم أشرف</h2>
      <p class="text-muted" style="font-size:13px;">مطوّر مستقل وصاحب مشاريع — بيبني أدوات تسهّل شغله وشغل فريقه، من أنظمة الحضور والرواتب لأدوات تحليل البيانات ومعالجة المستندات.</p>
    </div>

    <div class="glass-card card" style="margin:20px 0;border-color:rgba(46,230,255,0.4);box-shadow:0 0 20px rgba(46,230,255,0.15) inset;">
      <p style="font-size:13.5px;line-height:1.9;margin:0;">
        مهما زاد الشغل وضاقت المواعيد، الصلاة مالهاش تأجيل. الله لا يبارك في عمل يُلهي عن الصلاة، ولو الدنيا وقفت شوية عشانها، هتلاقيها هي اللي بتبارك باقي يومك.
      </p>
    </div>

    <blockquote class="glass-card card" style="border-color:rgba(168,85,247,0.4);font-style:italic;font-size:13px;line-height:1.9;color:var(--text-2);margin:0;">
      "مقالة رائعة. ونحن على مشارف العقد الجديد، ومع استمرار التكنولوجيا في المضي قدمًا، فإن الاحتمالات تصبح أكثر واقعية بأن الخيال العلمي سوف يتماشى مع الواقع العلمي.
      وسوف يلعب الخيال العلمي دورًا هامًا في تنمية مجتمعنا بهذه الطريقة، فهو لم يعد مجرد وسيلة للتسلية، ولكنه أصبح وسيلتنا لنتطلع إلى الأمام،
      كما أنه وسيلتنا لكي ننظر إلى أنفسنا ونتخيل طريقة مختلفة للعيش، سواء للأفضل أو للأسوأ."
    </blockquote>

    <div class="modal-actions" style="justify-content:center;">
      <button class="btn btn-primary" data-close-modal>إغلاق</button>
    </div>
  `);
}
