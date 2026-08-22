"""쇼츠 프레임의 세로 영역을 한 곳에서 계산한다.

정지 이미지와 비디오 오버레이가 이 결과를 공유해야 자막 배치가 달라지지 않는다.
"""

from __future__ import annotations

from dataclasses import dataclass


class LayoutOverflowError(ValueError):
    """모든 문구를 보존하면서 안전하게 배치할 공간이 없을 때 발생한다."""


@dataclass(frozen=True)
class VerticalRect:
    top: int
    bottom: int

    @property
    def height(self) -> int:
        return self.bottom - self.top


@dataclass(frozen=True)
class VerticalLayout:
    card: VerticalRect
    caption: VerticalRect
    narration: VerticalRect
    caption_lines: int
    narration_lines: int


def compute_vertical_layout(
    caption_lines: int,
    narration_lines: int,
    *,
    card_y: int = 280,
    preferred_card_height: int = 940,
    minimum_card_height: int = 560,
    caption_top_gap: int = 88,
    caption_line_height: int = 104,
    narration_line_height: int = 76,
    narration_bottom: int = 1740,
    minimum_gap: int = 24,
) -> VerticalLayout:
    """카드·큰 제목·내레이션 칩의 충돌 없는 세로 좌표를 반환한다.

    공간이 모자라면 문장을 자르는 대신 ``LayoutOverflowError``를 발생시킨다.
    호출자는 제목을 줄이거나 장면을 분할해야 한다.
    """
    if caption_lines < 1:
        raise ValueError("caption_lines must be at least 1")
    if narration_lines < 0:
        raise ValueError("narration_lines must not be negative")

    narration_height = narration_lines * narration_line_height + (20 if narration_lines else 0)
    narration_top = narration_bottom - narration_height

    # 기존 레이아웃의 시각 리듬: 제목이 한 줄 늘 때 카드가 한 줄 높이만큼 줄어든다.
    title_driven_height = preferred_card_height - (
        caption_lines - 1
    ) * caption_line_height

    # 실제 남은 공간으로 계산한 상한. 두 영역 사이에 최소 간격을 강제한다.
    space_driven_height = (
        narration_top
        - minimum_gap
        - card_y
        - caption_top_gap
        - caption_lines * caption_line_height
    )
    card_height = min(
        preferred_card_height,
        title_driven_height,
        space_driven_height,
    )

    if card_height < minimum_card_height:
        raise LayoutOverflowError(
            "화면 공간이 부족합니다: 제목을 줄이거나 장면을 분할하세요 "
            f"(caption={caption_lines}줄, narration={narration_lines}줄, "
            f"required_card_height={card_height}px, minimum={minimum_card_height}px)"
        )

    card = VerticalRect(card_y, card_y + card_height)
    caption = VerticalRect(
        card.bottom + caption_top_gap,
        card.bottom + caption_top_gap + caption_lines * caption_line_height,
    )
    narration = VerticalRect(narration_top, narration_bottom)

    if narration.top - caption.bottom < minimum_gap:
        raise AssertionError("layout invariant violated: caption overlaps narration")

    return VerticalLayout(
        card=card,
        caption=caption,
        narration=narration,
        caption_lines=caption_lines,
        narration_lines=narration_lines,
    )
