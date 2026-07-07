insert into document_types (company_id, name, is_required, sort_order)
select c.id, t.name, t.required, t.sort_order
from companies c
cross join (values
  ('Askerlik Durum Belgesi (E-Devletten Alınabilir)', false, 8),
  ('Aydınlatma Metni Teslim Tebellüğ Formu', true, 9),
  ('Bilgi Güvenliği Taahhütnamesi', true, 10),
  ('Fazla Mesai Muvafakatnamesi', true, 11),
  ('Banka Hesap Cüzdanı / IBAN İçeren Görsel', true, 12),
  ('İş Başı Eğitim Formu', true, 13),
  ('İş Başı Onay ve Teklif Formu', true, 14),
  ('Mezun Belgesi (E-Devletten Alınabilir)', true, 15),
  ('Nüfus Kayıt Örneği (E-Devletten Alınabilir)', true, 16)
) as t(name, required, sort_order)
where not exists (
  select 1 from document_types dt where dt.company_id = c.id and dt.name = t.name
);