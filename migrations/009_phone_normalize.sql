-- migrations/009 — нормализация телефонов (№5: поиск в любом формате)
-- Все телефоны приводим к виду +7XXXXXXXXXX (только цифры с +).
-- Безопасно повторно.

UPDATE clients SET phone =
  CASE
    -- 8XXXXXXXXXX (11 цифр, начинается с 8) → +7XXXXXXXXXX
    WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^8[0-9]{10}$'
      THEN '+7' || substr(regexp_replace(phone, '[^0-9]', '', 'g'), 2)
    -- 7XXXXXXXXXX (11 цифр) → +7XXXXXXXXXX
    WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^7[0-9]{10}$'
      THEN '+' || regexp_replace(phone, '[^0-9]', '', 'g')
    -- 10 цифр без кода → +7XXXXXXXXXX
    WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^[0-9]{10}$'
      THEN '+7' || regexp_replace(phone, '[^0-9]', '', 'g')
    ELSE phone
  END
WHERE phone IS NOT NULL AND phone <> ''
  AND phone <> (
    CASE
      WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^8[0-9]{10}$'
        THEN '+7' || substr(regexp_replace(phone, '[^0-9]', '', 'g'), 2)
      WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^7[0-9]{10}$'
        THEN '+' || regexp_replace(phone, '[^0-9]', '', 'g')
      WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^[0-9]{10}$'
        THEN '+7' || regexp_replace(phone, '[^0-9]', '', 'g')
      ELSE phone
    END
  );

-- Проверка: SELECT phone FROM clients WHERE phone !~ '^\+7[0-9]{10}$' AND phone <> '';
