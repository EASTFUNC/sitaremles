-- İzin türlerine yıllık hak ediş (gün) alanı ekle
alter table leave_types add column annual_entitled_days int not null default 0;

-- Test verisindeki izin türlerine hak ediş ata
update leave_types set annual_entitled_days = 14 where name = 'Yıllık İzin';
update leave_types set annual_entitled_days = 5 where name = 'Mazeret İzni';
-- Ücretsiz İzin 0 kalıyor (hak edişten düşülmez, sınırsız kabul ediyoruz)

-- Bakiye hesaplama fonksiyonu
create or replace function get_leave_balances(p_user_id uuid)
returns table (
  leave_type_id uuid,
  leave_type_name text,
  entitled_days int,
  used_days int,
  remaining_days int
)
language sql
security invoker
as $$
  select
    lt.id,
    lt.name,
    lt.annual_entitled_days,
    coalesce(sum(
      case when lr.status = 'approved'
        then (lr.end_date - lr.start_date + 1)
        else 0
      end
    ), 0)::int as used_days,
    lt.annual_entitled_days - coalesce(sum(
      case when lr.status = 'approved'
        then (lr.end_date - lr.start_date + 1)
        else 0
      end
    ), 0)::int as remaining_days
  from leave_types lt
  left join leave_requests lr
    on lr.leave_type_id = lt.id and lr.user_id = p_user_id
  where lt.company_id = (select company_id from user_roles where user_id = p_user_id limit 1)
  group by lt.id, lt.name, lt.annual_entitled_days;
$$;

grant execute on function get_leave_balances(uuid) to authenticated;