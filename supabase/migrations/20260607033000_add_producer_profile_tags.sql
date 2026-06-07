ALTER TABLE producers
  ADD COLUMN IF NOT EXISTS representative_works TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS use_cases TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS collaborators TEXT[] NOT NULL DEFAULT '{}';

UPDATE producers
SET
  representative_works = CASE
    WHEN COALESCE(array_length(representative_works, 1), 0) = 0 THEN ARRAY[
      U&'\98DE\513F\4E50\56E2\2014\7737\604B',
      U&'\738B\5FC3\51CC\2014\7FBD\6BDB',
      U&'\5B59\71D5\59FF\2014\9700\8981\4F60',
      U&'\8521\5065\96C5/\5B59\71D5\59FF\2014\539F\70B9',
      U&'\8427\656C\817E\2014\539F\8C05\6211',
      U&'\6797\5FD7\9896\2014\5FEB\4E50\81F3\4E0A',
      U&'\6C88\4EE5\8BDA\2014\60C5\4E66',
      U&'\9EC4\4E3D\73B2\2014\6211\8FD8\662F\4E0D\61C2',
      U&'\5B59\71D5\59FF\2014\5929\4F7F\7684\6307\7EB9',
      U&'\6797\4FCA\6770\2014\6C34\4ED9'
    ]
    ELSE representative_works
  END,
  use_cases = CASE
    WHEN COALESCE(array_length(use_cases, 1), 0) = 0 THEN ARRAY[
      U&'\534E\8BED\6D41\884C Demo',
      U&'\6447\6EDA\7F16\66F2',
      U&'\6292\60C5\526F\6B4C',
      U&'\5546\4E1A\5E7F\544A',
      U&'\5531\4F5C\4EBA\5C0F\6837'
    ]
    ELSE use_cases
  END,
  collaborators = CASE
    WHEN COALESCE(array_length(collaborators, 1), 0) = 0 THEN ARRAY[
      U&'\5F20\5B66\53CB',
      U&'\5B59\71D5\59FF',
      U&'\8521\4F9D\6797',
      U&'\6797\4FCA\6770',
      U&'\83AB\6587\851A',
      U&'\738B\5FC3\51CC'
    ]
    ELSE collaborators
  END,
  updated_at = NOW()
WHERE display_name = 'Terence Teo';
