do $$
declare
  holiday record;
begin
  for holiday in
    select *
    from (
      values
        ('2026-01-01'::date, '元旦，全線休息一日'),
        ('2026-02-17'::date, '農曆年初一，全線休息一日'),
        ('2026-02-18'::date, '農曆年初二，全線休息一日'),
        ('2026-02-19'::date, '農曆年初三，全線休息一日'),
        ('2026-04-03'::date, '耶穌受難節，全線休息一日'),
        ('2026-04-04'::date, '耶穌受難節翌日，全線休息一日'),
        ('2026-04-06'::date, '清明節翌日，全線休息一日'),
        ('2026-04-07'::date, '復活節星期一翌日，全線休息一日'),
        ('2026-05-01'::date, '勞動節，全線休息一日'),
        ('2026-05-25'::date, '佛誕翌日，全線休息一日'),
        ('2026-06-19'::date, '端午節，全線休息一日'),
        ('2026-07-01'::date, '香港特別行政區成立紀念日，全線休息一日'),
        ('2026-09-26'::date, '中秋節翌日，全線休息一日'),
        ('2026-10-01'::date, '國慶日，全線休息一日'),
        ('2026-10-19'::date, '重陽節翌日，全線休息一日'),
        ('2026-12-25'::date, '聖誕節，全線休息一日'),
        ('2026-12-26'::date, '聖誕節後首個周日，全線休息一日')
    ) as holidays(holiday_date, reason)
  loop
    if exists (
      select 1
      from public.holidays
      where doctor_id is null
        and clinic_id is null
        and holiday_date = holiday.holiday_date
        and start_time is null
        and end_time is null
    ) then
      update public.holidays
      set reason = holiday.reason
      where doctor_id is null
        and clinic_id is null
        and holiday_date = holiday.holiday_date
        and start_time is null
        and end_time is null;
    else
      insert into public.holidays (
        doctor_id,
        clinic_id,
        holiday_date,
        start_time,
        end_time,
        reason
      )
      values (
        null,
        null,
        holiday.holiday_date,
        null,
        null,
        holiday.reason
      );
    end if;
  end loop;
end $$;
