import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUpRight,
  ArrowRight,
  Dumbbell,
  Activity,
  Heart,
  Check,
  MoveUpRight,
  Sparkles,
} from 'lucide-react'
import { useResource } from '../context'
import { money } from '../api'
import { SectionHeading, LinkButton, Photo, CTA, Loading, ErrorBox } from '../components/UI'

const services = [
  {
    number: '01',
    icon: Dumbbell,
    title: 'Tập mạnh. Sống khỏe.',
    category: 'GYM & STRENGTH',
    text: 'Không gian tập tạ và thiết bị đa dạng. Xây dựng nền tảng sức mạnh theo cách của bạn.',
    image: '/images/strength.jpg',
    to: '/goi-tap',
  },
  {
    number: '02',
    icon: Heart,
    title: 'Chậm lại. Kết nối.',
    category: 'YOGA & MOBILITY',
    text: 'Tìm sự cân bằng trong từng hơi thở. Cải thiện độ linh hoạt qua mỗi chuyển động.',
    image:
      'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80',
    to: '/lich-tap?category=Yoga',
  },
  {
    number: '03',
    icon: Activity,
    title: 'Bật năng lượng.',
    category: 'HIIT & FUNCTIONAL',
    text: 'Những buổi tập đầy năng lượng, cùng huấn luyện viên và cộng đồng luôn cổ vũ bạn.',
    image: '/images/gym.jpg',
    to: '/lich-tap?category=HIIT',
  },
]

export default function Home() {
  const resource = useResource('/plans')
  const trainers = useResource('/trainers')
  return (
    <>
      <section className="hero">
        <img
          className="hero-image"
          src="/images/gym.jpg"
          alt="Không gian tập luyện với tạ và thiết bị tại phòng gym"
          fetchPriority="high"
        />
        <div className="hero-shade" />
        <div className="container hero-content">
          <div className="hero-copy">
            <p className="eyebrow">
              <span />
              YOUR JOURNEY. YOUR STRENGTH.
            </p>
            <h1>
              MẠNH HƠN
              <br />
              <span>MỖI NGÀY.</span>
            </h1>
            <p className="hero-description">
              Không cần hoàn hảo để bắt đầu.
              <br />
              Chỉ cần bạn sẵn sàng, Gym TN sẽ đồng hành.
            </p>
            <div className="hero-buttons">
              <LinkButton to="/goi-tap">Bắt đầu hành trình</LinkButton>
              <LinkButton to="/lich-tap" variant="glass">
                Khám phá lịch tập
              </LinkButton>
            </div>
            <div className="hero-proof">
              <span className="proof-icon">
                <Sparkles size={21} />
              </span>
              <div>
                <strong>Mọi thể trạng. Mọi điểm bắt đầu.</strong>
                <small>Một cộng đồng luôn chào đón bạn.</small>
              </div>
            </div>
          </div>
          <div className="hero-side">
            <span>EST. 2026</span>
            <div className="hero-sticker">
              <ArrowUpRight size={36} />
              <p>
                THAY ĐỔI
                <br />
                BẮT ĐẦU
                <br />
                <b>TỪ BẠN.</b>
              </p>
            </div>
            <span className="vertical-label">THAI NGUYEN · VIET NAM</span>
          </div>
          <a href="#kham-pha" className="scroll-cue">
            <ArrowDown size={15} /> CUỘN ĐỂ KHÁM PHÁ
          </a>
          <span className="hero-count">
            GYM TN <span> / KEEP MOVING</span>
          </span>
        </div>
      </section>
      <div className="brand-strip" aria-hidden="true">
        <span>BUILD YOUR STRENGTH</span>
        <span>✳</span>
        <span>FIND YOUR PEOPLE</span>
        <span>✳</span>
        <span>MOVE YOUR LIMITS</span>
        <span>✳</span>
        <span>GYM TN</span>
        <span>✳</span>
      </div>
      <section className="section container" id="kham-pha">
        <SectionHeading
          eyebrow="KHÔNG CHỈ LÀ MỘT PHÒNG TẬP"
          title={
            <>
              Không gian cho
              <br />
              phiên bản tiếp theo của bạn.
            </>
          }
          subtitle="Dù bạn đang bắt đầu hay muốn tiến xa hơn, luôn có một cách tập phù hợp ở Gym TN."
          link="/lien-he"
          linkText="Tìm hiểu Gym TN"
        />
        <div className="services-grid">
          {services.map((service) => (
            <Link to={service.to} className="service-card" key={service.number}>
              <Photo src={service.image} alt={service.category} />
              <div className="service-overlay" />
              <span className="service-number">{service.number}</span>
              <span className="service-arrow">
                <ArrowUpRight />
              </span>
              <div className="service-content">
                <p>
                  <service.icon size={17} />
                  {service.category}
                </p>
                <h3>{service.title}</h3>
                <span>{service.text}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="why-section">
        <div className="container why-grid">
          <div className="why-visual">
            <Photo src="/images/strength.jpg" alt="Vận động viên tập luyện với tạ" />
            <div className="why-tag">
              <Dumbbell size={27} />
              <div>
                ĐẦU TƯ VÀO BẢN THÂN.
                <br />
                <b>LUÔN XỨNG ĐÁNG.</b>
              </div>
            </div>
          </div>
          <div className="why-copy">
            <SectionHeading
              eyebrow="TẬP CÓ ĐỊNH HƯỚNG"
              title={
                <>
                  Một mục tiêu của bạn.
                  <br />
                  Cả đội ngũ đồng hành.
                </>
              }
            />
            <p className="muted">
              Chúng mình tin rằng một phòng tập tốt không chỉ có thiết bị. Đó còn là sự hướng dẫn
              đúng lúc và cảm giác bạn thuộc về nơi này.
            </p>
            <div className="why-benefits">
              {[
                [
                  '01',
                  'Lộ trình phù hợp với bạn',
                  'Trao đổi mục tiêu và bắt đầu ở mức độ phù hợp.',
                ],
                ['02', 'Chủ động lịch tập', 'Xem lịch, chọn lớp và giữ chỗ ngay trên website.'],
                [
                  '03',
                  'Thấy rõ hành trình của mình',
                  'Lưu nhật ký tập và theo dõi tiến độ trong trang hội viên.',
                ],
              ].map(([n, title, text]) => (
                <div key={n}>
                  <span>{n}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                  <MoveUpRight size={20} />
                </div>
              ))}
            </div>
            <LinkButton to="/huan-luyen-vien" variant="dark">
              Gặp đội ngũ huấn luyện
            </LinkButton>
          </div>
        </div>
      </section>
      <section className="section container">
        <SectionHeading
          eyebrow="GÓI TẬP CỦA BẠN"
          title="Chọn cam kết. Bắt đầu thay đổi."
          subtitle="Chi phí minh bạch. Quyền lợi rõ ràng. Chọn khoảng thời gian phù hợp với hành trình của bạn."
          link="/goi-tap"
          linkText="Xem tất cả quyền lợi"
        />
        {resource.loading ? (
          <Loading />
        ) : resource.error ? (
          <ErrorBox error={resource.error} retry={resource.reload} />
        ) : (
          <div className="pricing-grid">
            {resource.data.plans.slice(0, 3).map((plan) => (
              <div className={`price-card ${plan.popular ? 'featured' : ''}`} key={plan.id}>
                {!!plan.popular && (
                  <span className="popular-label">
                    <Sparkles size={13} /> LỰA CHỌN NỔI BẬT
                  </span>
                )}
                <p className="plan-duration">{plan.duration_days} NGÀY ĐỒNG HÀNH</p>
                <h3>{plan.name}</h3>
                <p className="plan-tagline">{plan.tagline}</p>
                <div className="price">
                  {money(plan.price)}
                  <small>/ {plan.duration_days} ngày</small>
                </div>
                <LinkButton
                  to={`/goi-tap?plan=${plan.id}`}
                  variant={plan.popular ? 'primary' : 'outline'}
                  className="w-full"
                >
                  Chọn gói này
                </LinkButton>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Check size={17} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="trainers-preview section">
        <div className="container">
          <SectionHeading
            eyebrow="NHỮNG NGƯỜI ĐỒNG HÀNH"
            title="Chuyên môn vững. Năng lượng thật."
            link="/huan-luyen-vien"
            linkText="Gặp toàn bộ đội ngũ"
          />
          <div className="trainers-grid">
            {trainers.data?.trainers.slice(0, 3).map((trainer) => (
              <Link to="/huan-luyen-vien" className="trainer-card" key={trainer.id}>
                <div className="trainer-photo">
                  <Photo src={trainer.image} alt={trainer.name} />
                  <span>{trainer.experience}+ NĂM KINH NGHIỆM</span>
                </div>
                <div className="trainer-info">
                  <div>
                    <h3>{trainer.name}</h3>
                    <p>{trainer.specialty}</p>
                  </div>
                  <ArrowUpRight />
                </div>
              </Link>
            ))}
          </div>
          {trainers.error && <ErrorBox error={trainers.error} retry={trainers.reload} />}
        </div>
      </section>
      <section className="section container faq-section">
        <SectionHeading
          eyebrow="BẠN CÓ THỂ ĐANG THẮC MẮC"
          title={
            <>
              Bước đầu mới.
              <br />
              Bớt một chút băn khoăn.
            </>
          }
          link="/lien-he"
          linkText="Nhắn cho chúng mình"
        />
        <div className="faq-list">
          {[
            [
              'Mình chưa từng tập gym, có thể tham gia không?',
              'Hoàn toàn có thể. Hãy chọn lớp dành cho người mới và trao đổi với huấn luyện viên trước buổi đầu để được hướng dẫn sử dụng thiết bị và kỹ thuật cơ bản.',
            ],
            [
              'Làm thế nào để đặt lớp trên website?',
              'Đăng ký tài khoản, chọn và thanh toán gói tập. Khi gói có hiệu lực, vào Lịch tập để chọn lớp phù hợp. Bạn có thể hủy lịch trước khi lớp bắt đầu.',
            ],
            [
              'Thanh toán và kích hoạt gói tập như thế nào?',
              'Bạn có thể tạo đơn và thanh toán tại quầy. Quản trị viên xác nhận để kích hoạt gói. Bản demo còn có thanh toán mô phỏng để thử toàn bộ quy trình, không thu tiền thật.',
            ],
            [
              'Mình có thể gia hạn khi gói cũ chưa hết không?',
              'Có. Khi thanh toán gói mới, thời gian gói được nối tiếp sau gói đang có để bạn không mất ngày tập.',
            ],
          ].map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <span>+</span>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
      <CTA />
    </>
  )
}
