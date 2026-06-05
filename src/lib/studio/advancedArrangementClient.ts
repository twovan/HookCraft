export async function fetchAdvancedArrangementStatus(params: URLSearchParams) {
  return fetch(`/api/kie/upload-cover/status?${params.toString()}`);
}

export async function createAdvancedArrangementTask(formData: FormData, instrumentalOnly: boolean) {
  return fetch(instrumentalOnly ? '/api/kie/add-instrumental' : '/api/kie/upload-cover', {
    method: 'POST',
    body: formData,
  });
}
