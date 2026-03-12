UPDATE public.imported_jobs
SET company = REPLACE(REPLACE(company, ' Â', ''), 'Â', ''),
    title = REPLACE(REPLACE(REPLACE(title, 'â€"', '–'), 'â€™', ''''), 'â€', '–'),
    location = REPLACE(REPLACE(location, ' Â', ''), 'Â', '')
WHERE company LIKE '%Â%' OR title LIKE '%â€%' OR location LIKE '%Â%';