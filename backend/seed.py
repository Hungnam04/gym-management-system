"""Explicit, idempotent demo data. Never automatically creates demo accounts."""
import json
from datetime import timedelta

from werkzeug.security import generate_password_hash
from app import db, one, stamp, now, complete_order


def seed_database():
    connection = db()
    connection.execute('BEGIN IMMEDIATE')
    try:
        for name, email, password, role in [
            ('Quản trị Gym TN', 'admin@gymtn.vn', 'Admin@12345', 'admin'),
            ('Nguyễn Minh Anh', 'member@gymtn.vn', 'Member@12345', 'member'),
        ]:
            if not one('SELECT id FROM users WHERE email=?', (email,)):
                connection.execute('INSERT INTO users(name,email,password_hash,role,phone,created_at) VALUES (?,?,?,?,?,?)', (name, email, generate_password_hash(password), role, '0901234567', stamp()))
        if not one('SELECT id FROM plans LIMIT 1'):
            for name, tagline, price, days, features, popular in [
                ('Khởi động', 'Bắt đầu một thói quen tốt.', 399000, 30, ['Tập luyện không giới hạn', 'Sử dụng toàn bộ thiết bị', 'Tham gia các lớp nhóm', 'Tủ đồ và phòng tắm'], 0),
                ('Bứt phá', 'Đủ thời gian để thấy sự thay đổi.', 999000, 90, ['Mọi quyền lợi gói Khởi động', 'Định hướng tập luyện ban đầu', 'Đánh giá thể lực mỗi tháng', 'Theo dõi tiến độ trên website'], 1),
                ('Chinh phục', 'Cam kết dài hạn với chính mình.', 3299000, 365, ['Mọi quyền lợi gói Bứt phá', 'Đánh giá thể lực định kỳ', 'Tư vấn lộ trình cá nhân tại quầy', 'Mức giá tốt nhất theo ngày'], 0),
            ]:
                connection.execute('INSERT INTO plans(name,tagline,price,duration_days,features,popular) VALUES (?,?,?,?,?,?)', (name, tagline, price, days, json.dumps(features, ensure_ascii=False), popular))
        if not one('SELECT id FROM trainers LIMIT 1'):
            for name, specialty, bio, experience, image in [
                ('Trần Quốc Huy', 'Strength & Conditioning', 'Tập đúng kỹ thuật, tiến bộ từng bước. Huy đồng hành cùng bạn xây nền tảng sức mạnh và sự tự tin trong mỗi buổi tập.', 6, 'photo-1605296867304-46d5465a13f1'),
                ('Lê Minh Phương', 'Yoga & Mobility', 'Phương giúp bạn tìm lại sự cân bằng qua hơi thở, chuyển động và những bài tập linh hoạt phù hợp với từng trình độ.', 5, 'photo-1518611012118-696072aa579a'),
                ('Nguyễn Hoàng Nam', 'Functional & HIIT', 'Năng lượng tích cực, bài tập đa dạng và tinh thần đồng đội. Các lớp của Nam dành cho những ai thích thử thách chính mình.', 4, 'photo-1534438327276-14e5300c3a48'),
            ]:
                connection.execute('INSERT INTO trainers(name,specialty,bio,experience,image) VALUES (?,?,?,?,?)', (name, specialty, bio, experience, f'https://images.unsplash.com/{image}?auto=format&fit=crop&w=800&q=80'))
        if not one('SELECT id FROM classes LIMIT 1'):
            trainer_ids = [r['id'] for r in connection.execute('SELECT id FROM trainers ORDER BY id LIMIT 3')]
            programs = [('Morning Yoga', 'Yoga', 1, 7, 'Studio 01', 'Mọi trình độ'), ('Strength Foundation', 'Strength', 0, 17, 'Weight Zone', 'Người mới'), ('HIIT Energy', 'HIIT', 2, 18, 'Studio 02', 'Trung cấp')]
            for day in range(1, 15):
                for title, category, trainer, hour, room, level in programs:
                    start = (now() + timedelta(days=day)).replace(hour=hour, minute=0, second=0, microsecond=0)
                    connection.execute('INSERT INTO classes(title,category,trainer_id,starts_at,duration_minutes,capacity,room,level,description) VALUES (?,?,?,?,?,?,?,?,?)', (title, category, trainer_ids[trainer % len(trainer_ids)], stamp(start), 60 if category != 'HIIT' else 45, 12 if category == 'Strength' else 20, room, level, 'Khởi động cùng huấn luyện viên, tập luyện theo hướng dẫn và giãn cơ cuối buổi. Có mặt trước 10 phút để chuẩn bị.'))
        if not one('SELECT id FROM posts LIMIT 1'):
            for title, category, excerpt, content, image in [
                ('Buổi đầu đến gym: bắt đầu từ đâu?', 'Tập luyện', 'Một chiếc khăn, một bình nước và tinh thần sẵn sàng. Bạn đã có đủ để bắt đầu.', 'Buổi đầu tiên không cần hoàn hảo. Hãy dành thời gian làm quen không gian, vị trí thiết bị và đội ngũ hướng dẫn.\n\nBắt đầu với những chuyển động bạn thấy thoải mái. Nhờ huấn luyện viên giới thiệu cách điều chỉnh máy và quan sát kỹ thuật của bạn.\n\nGhi lại những gì bạn đã tập và cảm nhận sau buổi tập. Đó là điểm khởi đầu để xây dựng thói quen phù hợp với lịch sinh hoạt của mình.\n\nĐừng so sánh mức tạ của bạn với người khác. Mỗi hành trình có một điểm bắt đầu riêng.', 'photo-1534438327276-14e5300c3a48'),
                ('Nhật ký tập luyện: nhìn lại để tiến xa', 'Thói quen', 'Đôi khi, tiến bộ nằm ở việc bạn đã đến phòng tập đều đặn hơn tuần trước.', 'Nhật ký tập luyện không cần phức tạp. Chỉ cần ghi tên buổi tập, thời lượng và vài dòng cảm nhận.\n\nSau một vài tuần, nhìn lại những ghi chú này để nhận ra điều gì giúp bạn duy trì động lực. Bạn thích tập buổi sáng hay buổi tối? Bạn thấy hào hứng hơn với lớp nhóm hay tập tự do?\n\nTại trang hội viên Gym TN, bạn có thể ghi lại buổi tập và theo dõi các chỉ số do chính mình nhập. Dữ liệu này là nhật ký cá nhân để bạn tham khảo khi trao đổi với huấn luyện viên.', 'photo-1517836357463-d25dfeac3438'),
                ('Tìm nhịp tập của riêng bạn', 'Cộng đồng', 'Tập một mình để tập trung. Tập cùng nhau để có thêm động lực.', 'Không có một kiểu tập luyện phù hợp với tất cả mọi người. Một số người yêu thích khoảng thời gian yên tĩnh với tai nghe, trong khi người khác cần năng lượng từ lớp nhóm.\n\nThử một lớp Yoga, một buổi Strength hoặc một lớp HIIT ở mức độ phù hợp. Trao đổi trước với huấn luyện viên về kinh nghiệm và nhu cầu của bạn.\n\nĐiều quan trọng là tìm được lịch trình bạn có thể duy trì và hoạt động khiến bạn muốn quay lại. Cộng đồng Gym TN luôn chào đón những khởi đầu mới.', 'photo-1518611012118-696072aa579a'),
            ]:
                connection.execute('INSERT INTO posts(title,category,excerpt,content,image,created_at) VALUES (?,?,?,?,?,?)', (title, category, excerpt, content, f'https://images.unsplash.com/{image}?auto=format&fit=crop&w=900&q=80', stamp()))
        member = one('SELECT * FROM users WHERE email=?', ('member@gymtn.vn',))
        if not one('SELECT id FROM orders WHERE user_id=?', (member['id'],)):
            plan = one('SELECT * FROM plans ORDER BY duration_days LIMIT 1')
            cursor = connection.execute('INSERT INTO orders(user_id,plan_id,plan_name,amount,duration_days,payment_method,created_at) VALUES (?,?,?,?,?,?,?)', (member['id'], plan['id'], plan['name'], plan['price'], plan['duration_days'], 'demo', stamp()))
            complete_order(one('SELECT * FROM orders WHERE id=?', (cursor.lastrowid,)))
            for day, weight in [(21, 72.5), (14, 72), (7, 71.8), (0, 71.5)]:
                connection.execute('INSERT INTO progress(user_id,recorded_on,weight,height,note) VALUES (?,?,?,?,?)', (member['id'], (now() - timedelta(days=day)).date().isoformat(), weight, 172, 'Số liệu minh họa'))
            for day, title in [(5, 'Upper body'), (3, 'Full body'), (1, 'Cardio & giãn cơ')]:
                connection.execute('INSERT INTO workouts(user_id,title,recorded_on,duration_minutes,note) VALUES (?,?,?,?,?)', (member['id'], title, (now() - timedelta(days=day)).date().isoformat(), 60, 'Buổi tập mẫu'))
        connection.commit()
    except Exception:
        connection.rollback()
        raise
