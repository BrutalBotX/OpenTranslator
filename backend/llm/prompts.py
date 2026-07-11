class TranslationPrompt:
    def build_system(self, context: dict) -> str:
        source_lang = self._lang_name(context.get("source_lang", "zh"))
        target_lang = self._lang_name(context.get("target_lang", "en"))
        genre = context.get("genre", "")

        lines = [
            f"You are translating a {source_lang} webnovel into {target_lang}."
        ]
        if genre:
            lines.append(f"Genre: {genre}.")
        lines.extend([
            "Rules:",
            "- Maintain the original meaning, style, and tone.",
            "- Use natural, idiomatic expressions in the target language.",
            "- Keep character names in their original form (pinyin/romaji).",
            "- Use the glossary for consistent terminology.",
            "- Follow the pronoun resolution rules for characters.",
            "",
        ])

        instructions = context.get("instructions", "")
        if instructions:
            lines.append("--- USER INSTRUCTIONS (follow these strictly) ---")
            lines.append(instructions)
            lines.append("")

        lines.extend([
            "--- NOVEL CONTEXT ---",
        ])

        if context.get("chapter_title"):
            lines.append(f"Chapter: {context['chapter_title']}")
        if context.get("chapter_number"):
            lines.append(f"Chapter #{context['chapter_number']}")
        if context.get("novel_summary"):
            lines.append(f"Story so far: {context['novel_summary'][:300]}")

        characters = context.get("characters", [])
        if characters:
            lines.append("")
            lines.append("--- CHARACTERS ---")
            for c in characters:
                variants = c.get("name_variants", [])
                aliases = f" (aka: {', '.join(variants)})" if variants else ""
                state = c.get("state_summary", "")
                state_str = f" — {state[:100]}" if state else ""
                lines.append(
                    f"- {c['name']}{aliases}: {c.get('role', '?')}, {c.get('gender', '?')}, "
                    f"status={c.get('status', '?')}{state_str}"
                )

        glossary = context.get("glossary", [])
        if glossary:
            lines.append("")
            lines.append("--- GLOSSARY ---")
            for g in glossary:
                lines.append(f"- {g['source_term']} → {g['target_term']} ({g.get('category', 'term')})")

        return "\n".join(lines)

    def build_user(self, text: str, context: dict) -> str:
        lines = []

        sliding = context.get("sliding_window")
        if sliding:
            lines.append("--- CONTEXT FROM SURROUNDING TEXT ---")

            prev = sliding.get("previous_translations", [])
            if prev:
                lines.append("Previous segments (already translated):")
                for p in prev:
                    lines.append(f"  Source: {p['source_text']}")
                    if p.get("translation"):
                        lines.append(f"  Translation: {p['translation']}")
                    lines.append("")

            upcoming = sliding.get("next_sources", [])
            if upcoming:
                lines.append("Upcoming segments (for context only, do not translate):")
                for n in upcoming:
                    lines.append(f"  {n['source_text']}")

            lines.append("")

        characters = context.get("characters", [])
        active_names = [c["name"] for c in characters]
        if active_names:
            lines.append("Active characters in scene: " + ", ".join(active_names))

        matching_terms = context.get("matching_glossary", [])
        if not matching_terms:
            glossary = context.get("glossary", [])
            matching_terms = [g for g in glossary if g.get("source_term", "") in text]
        if matching_terms:
            lines.append("Glossary terms in this text:")
            for g in matching_terms:
                lines.append(f"  {g['source_term']} → {g['target_term']} ({g.get('category', 'term')})")

        tm = context.get("translation_memory", [])
        if tm:
            lines.append("")
            lines.append("--- SIMILAR PAST TRANSLATIONS (reference style) ---")
            for item in tm[:3]:
                if item.get("source_text") and item.get("target_text"):
                    lines.append(f"  Source: {item['source_text']}")
                    lines.append(f"  Translation: {item['target_text']}")

        lines.append("")
        lines.append("Translate the following text:")
        lines.append(text)
        lines.append("")
        lines.append("Translation (maintain the same style and terminology as previous segments):")

        return "\n".join(lines)

    def build_batch_prompt(self, batch_segments: list, context: dict, previous_translations: list = None) -> str:
        """Build a prompt for translating multiple segments in a single LLM call."""
        lines = []

        sliding = context.get("sliding_window", {})
        prev_batch = sliding.get("previous_translations", [])
        if prev_batch:
            lines.append("--- PREVIOUS TRANSLATIONS (for flow context) ---")
            for p in prev_batch:
                lines.append(f"  {p['translation']}")
            lines.append("")

        upcoming = sliding.get("next_sources", [])
        if upcoming:
            lines.append("--- UPCOMING TEXT (for context only, do not translate) ---")
            for n in upcoming:
                lines.append(f"  {n['source_text']}")
            lines.append("")

        characters = context.get("characters", [])
        active_names = [c["name"] for c in characters]
        if active_names:
            lines.append("Active characters in scene: " + ", ".join(active_names))

        glossary = context.get("glossary", [])
        all_text = " ".join(s["source_text"] for s in batch_segments)
        matching_terms = [g for g in glossary if g.get("source_term", "") in all_text]
        if matching_terms:
            lines.append("Glossary terms used below:")
            for g in matching_terms:
                lines.append(f"  {g['source_term']} → {g['target_term']} ({g.get('category', 'term')})")

        lines.append("")
        lines.append(f"Translate the following {len(batch_segments)} segments. Keep the numbering.")
        lines.append("")
        for s in batch_segments:
            lines.append(f"[SEG {s['segment_number']}]")
            lines.append(s["source_text"])
            lines.append("")

        lines.append("--- OUTPUT FORMAT ---")
        lines.append("Return each translation with its [SEG N] tag:")
        lines.append("")
        for s in batch_segments:
            lines.append(f"[SEG {s['segment_number']}]")
            lines.append("(translation)")
            lines.append("")

        return "\n".join(lines)

    def _lang_name(self, code: str) -> str:
        names = {"zh": "Chinese", "ja": "Japanese", "ko": "Korean", "en": "English"}
        return names.get(code, code)


class DetectionPrompt:
    def build(self, text: str, context: dict) -> str:
        lines = [
            "Analyze the following text for translation ambiguity issues.",
            "Check for each of the following and report any that apply:",
            "",
            "1. PRONOUNS: Pronouns (他/她/它/彼/彼女) without a clear referent in the known characters list.",
            "2. NEW NAMES: Any 2-4 character Chinese name or Japanese name not in known characters or glossary.",
            "3. IDIOMS: Chengyu (成语), yojijukugo, or other idiomatic expressions.",
            "4. CULTURAL TERMS: Terms specific to xianxia/wuxia/fantasy settings (cultivation realms, techniques, etc.).",
            "5. GENDER: Characters whose gender is ambiguous from the text.",
            "",
            "Known characters:",
        ]

        for c in context.get("characters", []):
            variants = c.get("name_variants", [])
            names = [c["name"]] + list(variants)
            lines.append(f"- {', '.join(names)} ({c.get('gender', '?')}, {c.get('role', '?')})")

        lines.extend(["", "Known glossary terms:"])
        for g in context.get("glossary", []):
            lines.append(f"- {g['source_term']} → {g['target_term']}")

        lines.extend(["", "Text to analyze:", text])

        return "\n".join(lines)
