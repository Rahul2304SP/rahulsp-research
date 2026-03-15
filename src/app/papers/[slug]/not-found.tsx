export default function NotFound() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-24 text-center">
      <h1 className="font-serif text-3xl text-[#fafafa] mb-4">
        Paper Not Found
      </h1>
      <p className="text-[#a1a1aa] mb-8">
        The paper you are looking for does not exist or has been moved.
      </p>
      <a
        href="/"
        className="text-sm text-[#22c55e] hover:underline"
      >
        &larr; Back to Research
      </a>
    </div>
  );
}
