alter table profiles drop constraint if exists profiles_status_check;

alter table profiles add constraint profiles_status_check
check (status in ('application', 'onboarding', 'active', 'on_leave', 'terminated', 'blacklisted'));

comment on column profiles.status is 'application: basvuru | onboarding: ise alim sureci | active: calisiyor | on_leave: izinli | terminated: ayrildi | blacklisted: kara liste';