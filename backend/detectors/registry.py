from backend.detectors.base import BaseDetector
from backend.detectors.zh import ChineseDetector
from backend.detectors.ja import JapaneseDetector
from backend.detectors.ko import KoreanDetector


class DetectorRegistry:
    def __init__(self):
        self._detectors: dict[str, BaseDetector] = {
            "zh": ChineseDetector(),
            "ja": JapaneseDetector(),
            "ko": KoreanDetector(),
        }

    def register(self, lang: str, detector: BaseDetector):
        self._detectors[lang] = detector

    def get_detector(self, lang: str) -> BaseDetector | None:
        return self._detectors.get(lang)


