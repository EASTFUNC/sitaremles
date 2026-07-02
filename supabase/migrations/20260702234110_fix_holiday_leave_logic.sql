-- Resmi tatiller varsayılan olarak izin bakiyesinden DÜŞÜLMEMELİ (zaten herkes için tatil)
update holidays set counts_as_annual_leave = false where holiday_type = 'resmi_tatil';